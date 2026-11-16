/**
 * Lagos Transit Navigator — TypeScript research-mode route planner.
 *
 * This module intentionally returns no public directions by default because the
 * included route observations are historical (2022–2023) and unverified.
 * Pass { researchMode: true } only for internal dataset testing.
 */

export type RouteNode = {
  node_id: string;
  stop_name: string;
  latitude: number;
  longitude: number;
  service_hub: string | null;
  is_supporting_interchange: boolean;
  source_period: string;
  evidence_status: string;
};

export type RouteStop = {
  stop_id: string;
  stop_name: string;
  latitude: number;
  longitude: number;
  sequence: number;
  observed_arrival: string;
  observed_departure: string;
  role_in_this_trip: "origin" | "intermediate" | "destination";
  board_alight_permission: "not_in_source_data";
};

export type RideEdge = {
  edge_id: string;
  edge_type: "ride";
  route_id: string;
  route_name: string;
  vehicle_type: string;
  trip_direction: string;
  from_node: string;
  from_stop_name: string;
  to_node: string;
  to_stop_name: string;
  observed_duration_median_min: number | null;
  shape_distance_m: number;
  source_feed_period: string;
  evidence_status: string;
  public_routing_enabled: boolean;
  regulatory_review_required: boolean;
  stop_sequence: RouteStop[];
};

export type ProximityTransfer = {
  from_node: string;
  from_stop_name: string;
  to_node: string;
  to_stop_name: string;
  distance_m: number;
  estimated_walk_min_at_4kmh: number;
  transfer_status: string;
};

export type RouteGraph = {
  nodes: RouteNode[];
  ride_edges: RideEdge[];
  proximity_transfer_candidates: ProximityTransfer[];
};

export type RouteLeg =
  | {
      type: "ride";
      edge_id: string;
      route_id: string;
      route_name: string;
      vehicle_type: string;
      from_stop: string;
      to_stop: string;
      historical_duration_min: number | null;
      duration_basis: "historical_observed_median" | "rough_distance_fallback_not_observed";
      intermediate_stops: string[];
      source_period: string;
      status: "historical_unverified";
      regulatory_review_required: boolean;
    }
  | {
      type: "transfer";
      from_stop: string;
      to_stop: string;
      straight_line_distance_m: number;
      estimated_walk_min: number;
      status: "unverified_candidate_walk_transfer";
    };

export type PlannedRoute = {
  start_hub: string;
  end_hub: string;
  origin_stop: string;
  destination_stop: string;
  objective: "fastest" | "fewest_transfers";
  score: number;
  ride_legs: number;
  transfers: number;
  walking_transfer_segments: number;
  legs: RouteLeg[];
  evidence_status: "historical_unverified_research_only";
  public_directions_allowed: false;
  warning: string;
};

export type PlannerOptions = {
  /** Must be true to inspect historical/unverified candidate paths. */
  researchMode?: boolean;
  /** Includes proximity-based walking links; these are unverified and off by default. */
  allowProximityTransfers?: boolean;
  limit?: number;
  maxRideLegs?: number;
  objective?: "fastest" | "fewest_transfers";
};

export type PlannerResult = {
  routes: PlannedRoute[];
  public_directions_allowed: false;
  message?: string;
  research_mode: boolean;
  proximity_transfers_enabled: boolean;
};

type SearchState = {
  cost: number;
  startNode: string;
  currentNode: string;
  rideCount: number;
  legs: RouteLeg[];
  visited: Set<string>;
};

const HISTORICAL_WARNING =
  "Historical 2022–2023 route observations. Do not use as live travel instructions until current service, boarding/alighting, transfers, legality and fares are independently verified.";

function pushMin(queue: SearchState[], state: SearchState): void {
  queue.push(state);
  queue.sort((a, b) => a.cost - b.cost);
}

/**
 * Search route patterns using exact shared terminal stop IDs as interchanges.
 * Intermediate stops are retained as descriptive trace points, not boarding points.
 */
export function planRoutes(
  graph: RouteGraph,
  fromHub: string,
  toHub: string,
  options: PlannerOptions = {},
): PlannerResult {
  const researchMode = options.researchMode === true;
  const allowProximity = options.allowProximityTransfers === true;
  const limit = Math.max(1, Math.min(options.limit ?? 3, 10));
  const maxRideLegs = Math.max(1, Math.min(options.maxRideLegs ?? 4, 8));
  const objective = options.objective ?? "fastest";

  if (!researchMode) {
    return {
      routes: [],
      public_directions_allowed: false,
      message:
        "No currently verified route edges are enabled. Historical candidates are available only in internal research mode.",
      research_mode: false,
      proximity_transfers_enabled: allowProximity,
    };
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.node_id, node]));
  const startNodes = graph.nodes
    .filter((node) => (node.service_hub ?? "").toLowerCase() === fromHub.toLowerCase())
    .map((node) => node.node_id);
  const destinationNodes = new Set(
    graph.nodes
      .filter((node) => (node.service_hub ?? "").toLowerCase() === toHub.toLowerCase())
      .map((node) => node.node_id),
  );

  if (startNodes.length === 0 || destinationNodes.size === 0) {
    return {
      routes: [],
      public_directions_allowed: false,
      message: "The selected hub has no matched terminal nodes in this historical extract.",
      research_mode: true,
      proximity_transfers_enabled: allowProximity,
    };
  }

  const ridesFrom = new Map<string, RideEdge[]>();
  for (const edge of graph.ride_edges) {
    const list = ridesFrom.get(edge.from_node) ?? [];
    list.push(edge);
    ridesFrom.set(edge.from_node, list);
  }

  const transfersFrom = new Map<string, ProximityTransfer[]>();
  if (allowProximity) {
    for (const transfer of graph.proximity_transfer_candidates) {
      const forward = transfersFrom.get(transfer.from_node) ?? [];
      forward.push(transfer);
      transfersFrom.set(transfer.from_node, forward);

      const reverse = transfersFrom.get(transfer.to_node) ?? [];
      reverse.push({
        ...transfer,
        from_node: transfer.to_node,
        to_node: transfer.from_node,
        from_stop_name: transfer.to_stop_name,
        to_stop_name: transfer.from_stop_name,
      });
      transfersFrom.set(transfer.to_node, reverse);
    }
  }

  const queue: SearchState[] = startNodes.map((nodeId) => ({
    cost: 0,
    startNode: nodeId,
    currentNode: nodeId,
    rideCount: 0,
    legs: [],
    visited: new Set([nodeId]),
  }));
  const results: PlannedRoute[] = [];
  const seen = new Set<string>();
  let expansions = 0;

  while (queue.length > 0 && results.length < limit && expansions < 250_000) {
    const state = queue.shift()!;
    expansions += 1;

    if (destinationNodes.has(state.currentNode) && state.legs.length > 0) {
      const signature = state.legs
        .map((leg) => (leg.type === "ride" ? leg.edge_id : `${leg.from_stop}->${leg.to_stop}`))
        .join("|");
      if (!seen.has(signature)) {
        seen.add(signature);
        const rideLegs = state.legs.filter((leg) => leg.type === "ride").length;
        results.push({
          start_hub: fromHub,
          end_hub: toHub,
          origin_stop: nodeById.get(state.startNode)?.stop_name ?? "Unknown",
          destination_stop: nodeById.get(state.currentNode)?.stop_name ?? "Unknown",
          objective,
          score: Number(state.cost.toFixed(2)),
          ride_legs: rideLegs,
          transfers: Math.max(0, rideLegs - 1),
          walking_transfer_segments: state.legs.filter((leg) => leg.type === "transfer").length,
          legs: state.legs,
          evidence_status: "historical_unverified_research_only",
          public_directions_allowed: false,
          warning: HISTORICAL_WARNING,
        });
      }
      continue;
    }

    if (state.rideCount >= maxRideLegs) continue;

    for (const edge of ridesFrom.get(state.currentNode) ?? []) {
      if (state.visited.has(edge.to_node)) continue;
      const duration =
        edge.observed_duration_median_min ?? (edge.shape_distance_m > 0 ? edge.shape_distance_m / 180 : 0);
      const durationBasis =
        edge.observed_duration_median_min == null
          ? "rough_distance_fallback_not_observed"
          : "historical_observed_median";
      const stepCost = objective === "fewest_transfers" ? 1 + duration / 10_000 : duration;
      const leg: RouteLeg = {
        type: "ride",
        edge_id: edge.edge_id,
        route_id: edge.route_id,
        route_name: edge.route_name,
        vehicle_type: edge.vehicle_type,
        from_stop: edge.from_stop_name,
        to_stop: edge.to_stop_name,
        historical_duration_min: edge.observed_duration_median_min,
        duration_basis: durationBasis,
        intermediate_stops: edge.stop_sequence.slice(1, -1).map((stop) => stop.stop_name),
        source_period: edge.source_feed_period,
        status: "historical_unverified",
        regulatory_review_required: edge.regulatory_review_required,
      };
      const visited = new Set(state.visited);
      visited.add(edge.to_node);
      pushMin(queue, {
        cost: state.cost + stepCost,
        startNode: state.startNode,
        currentNode: edge.to_node,
        rideCount: state.rideCount + 1,
        legs: [...state.legs, leg],
        visited,
      });
    }

    if (allowProximity) {
      for (const transfer of transfersFrom.get(state.currentNode) ?? []) {
        if (state.visited.has(transfer.to_node)) continue;
        const leg: RouteLeg = {
          type: "transfer",
          from_stop: transfer.from_stop_name,
          to_stop: transfer.to_stop_name,
          straight_line_distance_m: transfer.distance_m,
          estimated_walk_min: transfer.estimated_walk_min_at_4kmh,
          status: "unverified_candidate_walk_transfer",
        };
        const visited = new Set(state.visited);
        visited.add(transfer.to_node);
        pushMin(queue, {
          cost: state.cost + transfer.estimated_walk_min_at_4kmh,
          startNode: state.startNode,
          currentNode: transfer.to_node,
          rideCount: state.rideCount,
          legs: [...state.legs, leg],
          visited,
        });
      }
    }
  }

  return {
    routes: results,
    public_directions_allowed: false,
    research_mode: true,
    proximity_transfers_enabled: allowProximity,
    message:
      results.length > 0
        ? "Research candidates only. These routes are not approved for public travel directions."
        : "No route chain found in the currently extracted historical network.",
  };
}
