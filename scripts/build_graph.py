#!/usr/bin/env python3
"""
Eko Way — build the app's transit dataset from the Route Graph v1 research pack.

Reads the untouched source files in data/raw/ and writes app/data/graph.json.

Rules honoured (from the PRD and the graph README):
  • public_routing_enabled stays false on every edge. Nothing is invented.
  • Nodes are never merged by name — only by identical source stop_id.
  • Intermediate stops are descriptive only (board/alight = "not_in_source_data").
  • Proximity candidates are kept in a review queue, never as ride/walk edges.
  • Modes stay distinct: Danfo, Korope, LT Bus, FLM. Keke is not manufactured.
  • GeoJSON output uses EPSG:4326 [lng, lat] ordering.

Run: python3 scripts/build_graph.py
"""
from __future__ import annotations

import csv
import json
import os
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT_DIR = os.path.join(ROOT, "app", "public", "data")

TRACE_POINTS_PER_EDGE = 64


def read_csv(name: str):
    with open(os.path.join(RAW, name), newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def load_json(name: str):
    with open(os.path.join(RAW, name), encoding="utf-8") as fh:
        return json.load(fh)


# --------------------------------------------------------------------------
# Mode taxonomy. Source labels are preserved; canonical classes never merge.
# --------------------------------------------------------------------------
MODE_MAP = {
    "Danfo (yellow)": {"id": "danfo", "class": "danfo", "label": "Danfo", "subtype": "yellow"},
    "Danfo (other colours)": {"id": "danfo", "class": "danfo", "label": "Danfo", "subtype": "other colours"},
    "Korope (yellow)": {"id": "korope", "class": "korope", "label": "Korope", "subtype": "yellow"},
    "Korope (other colours)": {"id": "korope", "class": "korope", "label": "Korope", "subtype": "other colours"},
    "LT Bus": {"id": "lt_bus", "class": "lt_bus", "label": "LT Bus", "subtype": None},
}


def mode_of(source_label: str) -> dict:
    if source_label not in MODE_MAP:
        raise SystemExit(f"Unknown vehicle class, refusing to invent a mode: {source_label!r}")
    return MODE_MAP[source_label]


def days_to_words(mask: str) -> str:
    """'MTWTF--' -> 'Mon–Fri'. Purely descriptive of the 2022–23 observation."""
    if not mask or len(mask) != 7:
        return "not recorded"
    names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    on = [names[i] for i, ch in enumerate(mask) if ch not in "- "]
    if not on:
        return "not recorded"
    if mask == "MTWTF--":
        return "Mon–Fri"
    if mask == "-----SS":
        return "Sat–Sun"
    if mask == "MTWTFSS":
        return "Daily"
    return ", ".join(on)


def hhmm(value: str | None) -> str | None:
    if not value:
        return None
    return value[:5]


# --------------------------------------------------------------------------
# Traces: keep one representative LineString per edge, downsampled.
# --------------------------------------------------------------------------
def build_traces(edge_ids: set[str]) -> dict[str, list[list[float]]]:
    """One representative LineString per edge, downsampled.

    The supplied CSV is malformed (every row is wrapped in one pair of quotes and
    the header is a single field), so it is parsed positionally rather than with
    csv.DictReader. Coordinates are a flat "lng,lat,lng,lat,..." string.
    """
    path = os.path.join(RAW, "route_trace_geometries.csv")
    traces: dict[str, list[list[float]]] = {}
    if not os.path.exists(path):
        return traces

    with open(path, encoding="utf-8-sig") as fh:
        lines = [ln for ln in fh.read().split("\n") if ln.strip()]

    marker = 'LineString,""'
    for line in lines[1:]:
        idx = line.find(marker)
        if idx < 0:
            continue
        coord_start = idx + len(marker)
        coord_end = line.find('""', coord_start)
        if coord_end < 0:
            continue
        coords = line[coord_start:coord_end]
        tail = line[coord_end + 2:].split(",")
        if len(tail) < 5:
            continue
        edge_id = tail[-4].strip()
        if edge_id not in edge_ids or edge_id in traces:
            continue
        flat = [c for c in coords.split(",") if c.strip()]
        if len(flat) % 2:
            flat = flat[:-1]
        pts = [(float(flat[i]), float(flat[i + 1])) for i in range(0, len(flat), 2)]
        if len(pts) < 2:
            continue
        step = max(1, len(pts) // TRACE_POINTS_PER_EDGE)
        sampled = pts[::step]
        if sampled[-1] != pts[-1]:
            sampled.append(pts[-1])
        traces[edge_id] = [[round(x, 5), round(y, 5)] for x, y in sampled]
    return traces


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    graph = load_json("route_graph.json")
    patterns = load_json("route_patterns.json")
    stats = load_json("graph_statistics.json")
    nodes = {n["node_id"]: n for n in graph["nodes"]}
    pattern_by_edge = {p["edge_id"]: p for p in patterns}

    # ---- stops -----------------------------------------------------------
    stops = []
    stops_by_hub: dict[str, list[str]] = {}
    for node in graph["nodes"]:
        stops.append(
            {
                "id": node["node_id"],
                "name": node["stop_name"],
                "lat": node["latitude"],
                "lng": node["longitude"],
                "hub": node.get("service_hub"),
                "interchange": bool(node.get("is_supporting_interchange")),
                "source_period": node["source_period"],
                "evidence": node["evidence_status"],
            }
        )
        hub = node.get("service_hub") or "unsupported"
        stops_by_hub.setdefault(hub, []).append(node["node_id"])

    # ---- interchanges ----------------------------------------------------
    interchange_ids = {r["stop_id"] for r in graph["exact_terminal_interchanges"]}
    interchanges = []
    for row in graph["exact_terminal_interchanges"]:
        interchanges.append(
            {
                "stop_id": row["stop_id"],
                "name": row["stop_name"],
                "lat": row["latitude"],
                "lng": row["longitude"],
                "incoming": row["incoming_ride_edges"],
                "outgoing": row["outgoing_ride_edges"],
                "type": row["transfer_type"],
                "walk_m": row.get("walk_distance_m", 0),
                "status": row["transfer_status"],
            }
        )

    # ---- ride edges ------------------------------------------------------
    traces = build_traces({e["edge_id"] for e in graph["ride_edges"]})
    edges = []
    routes: dict[str, dict] = {}
    for edge in graph["ride_edges"]:
        pat = pattern_by_edge.get(edge["edge_id"], {})
        mode = mode_of(edge["vehicle_type"])
        route = routes.setdefault(
            edge["route_id"],
            {
                "id": edge["route_id"],
                "name": edge["route_name"],
                "mode": mode,
                "source_mode": edge["vehicle_type"],
                "directions": 0,
            },
        )
        route["directions"] += 1

        raw_stops = pat.get("stop_sequence", [])
        seq = [
            {
                "id": s["stop_id"],
                "name": s["stop_name"],
                "lat": s["latitude"],
                "lng": s["longitude"],
                "seq": s["sequence"],
                "role": s["role_in_this_trip"],
                # Never promoted to boardable/alightable:
                "permission": s.get("board_alight_permission", "not_in_source_data"),
            }
            for s in raw_stops
        ]

        edges.append(
            {
                "id": edge["edge_id"],
                "route_id": edge["route_id"],
                "route_name": edge["route_name"],
                "mode": mode,
                "source_mode": edge["vehicle_type"],
                "direction": edge["trip_direction"],
                "from": edge["from_node"],
                "to": edge["to_node"],
                "from_name": edge["from_stop_name"],
                "to_name": edge["to_stop_name"],
                "from_hub": edge.get("from_service_hub"),
                "to_hub": edge.get("to_service_hub"),
                "duration_min": edge.get("observed_duration_median_min"),
                "duration_mean_min": edge.get("observed_duration_mean_min"),
                "duration_samples": edge.get("duration_sample_count"),
                "distance_m": edge.get("shape_distance_m"),
                "days_mask": edge.get("operating_days_historical"),
                "days": days_to_words(edge.get("operating_days_historical") or ""),
                "start": hhmm(edge.get("operating_start_historical")),
                "end": hhmm(edge.get("operating_end_historical")),
                "trip_samples": edge.get("sample_trip_count"),
                "stops": seq,
                "intermediate_count": edge.get("intermediate_stop_count"),
                "trace": traces.get(edge["edge_id"]),
                "source_period": edge["source_feed_period"],
                "evidence": edge["evidence_status"],
                "public_routing_enabled": False,  # never true in v1
                "board_alight_policy": edge.get("board_alight_policy"),
                "regulatory": {
                    "required": bool(edge.get("regulatory_review_required")),
                    "note": edge.get("regulatory_review_note") or None,
                },
            }
        )

    edges.sort(key=lambda e: e["id"])
    edge_ids_by_from: dict[str, list[str]] = {}
    edge_ids_by_to: dict[str, list[str]] = {}
    for e in edges:
        edge_ids_by_from.setdefault(e["from"], []).append(e["id"])
        edge_ids_by_to.setdefault(e["to"], []).append(e["id"])

    for s in stops:
        s["edges_from"] = edge_ids_by_from.get(s["id"], [])
        s["edges_to"] = edge_ids_by_to.get(s["id"], [])
        s["interchange"] = s["id"] in interchange_ids or s["interchange"]

    # ---- hubs ------------------------------------------------------------
    hub_meta = {
        "Yaba": {"aliases": ["Yaba", "Sabo", "Sabo Yaba", "Yabatech", "Ebute Metta"], "tier": "primary"},
        "Surulere": {"aliases": ["Surulere", "Ojuelegba", "Ojuelegba Lawanson", "Masha", "Barracks", "Stadium"], "tier": "primary"},
        "Ikeja": {"aliases": ["Ikeja", "Allen", "Allen Avenue", "Old Secretariat", "Computer Village", "Ogba"], "tier": "primary"},
        "Oshodi": {"aliases": ["Oshodi", "Oshodi Ilupeju", "Oshodi Brown", "Oshodi Isale"], "tier": "primary"},
        "CMS": {"aliases": ["CMS", "C.M.S", "Marina", "Obalende", "Lagos Island", "Idumota"], "tier": "primary"},
        "Lekki Phase 1": {"aliases": ["Lekki", "Lekki Phase 1", "Lekki Phase One", "Admiralty", "The Palms"], "tier": "primary"},
    }
    hubs = []
    for hub_id, stop_ids in sorted(stops_by_hub.items()):
        if hub_id == "unsupported" or not stop_ids:
            continue
        lats = [nodes[i]["latitude"] for i in stop_ids]
        lngs = [nodes[i]["longitude"] for i in stop_ids]
        meta = hub_meta.get(hub_id, {"aliases": [hub_id], "tier": "supporting"})
        hubs.append(
            {
                "id": hub_id,
                "name": hub_id,
                "aliases": meta["aliases"],
                "tier": meta["tier"],
                "stop_count": len(stop_ids),
                "interchange_count": sum(1 for i in stop_ids if i in interchange_ids),
                "lat": round(sum(lats) / len(lats), 6),
                "lng": round(sum(lngs) / len(lngs), 6),
                "stop_ids": stop_ids,
            }
        )

    # ---- proximity queue + external FLM ----------------------------------
    proximity = [
        {
            "id": f"prox_{i+1:02d}",
            "from": r["from_node"],
            "from_name": r["from_stop_name"],
            "to": r["to_node"],
            "to_name": r["to_stop_name"],
            "distance_m": r["distance_m"],
            "walk_min": r["estimated_walk_min_at_4kmh"],
            "status": r["transfer_status"],
            "note": r.get("note"),
        }
        for i, r in enumerate(graph["proximity_transfer_candidates"])
    ]

    flm = [
        {
            "id": r["candidate_id"],
            "from": r["from_place"],
            "to": r["to_place"],
            "vehicle": r["vehicle_type"],
            "source": r["source_name"],
            "source_url": r["source_url"],
            "evidence": r["evidence_status"],
            "geometry": bool(r.get("geometry_available")),
            "exact_stops": bool(r.get("exact_stop_ids_available")),
            "current_service": bool(r.get("current_service_confirmed")),
            "public": False,
            "notes": r.get("notes"),
        }
        for r in graph["external_flm_corridor_candidates"]
    ]

    # ---- hub-pair research matrix ---------------------------------------
    matrix = []
    for r in read_csv("hub_pair_research_summary.csv"):
        matrix.append(
            {
                "from": r["from_hub"],
                "to": r["to_hub"],
                "exact_paths": int(r["exact_terminal_path_count_returned"] or 0),
                "best_origin_stop": r["best_exact_origin_stop"] or None,
                "best_destination_stop": r["best_exact_destination_stop"] or None,
                "best_modes": r["best_exact_modes"] or None,
                "best_routes": r["best_exact_route_names"] or None,
                "best_duration_min": float(r["best_exact_historical_duration_sum_min"])
                if r["best_exact_historical_duration_sum_min"]
                else None,
                "proximity_paths": int(r["proximity_path_count_returned"] or 0),
                "proximity_only": r["proximity_only_path_found"] == "True",
                "public_directions": False,
                "status": r["status"],
            }
        )

    integrity = [
        {"test": r["test"], "passed": r["passed"] == "True", "detail": r["detail"]}
        for r in read_csv("integrity_tests.csv")
    ]

    payload = {
        "meta": {
            "product": "Eko Way",
            "graph": "Lagos MVP Historical Public Transport Route Graph v1.0.0",
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source_dataset": graph["source_dataset"],
            "source_feed_period": graph["source_feed_period"],
            "scope": graph["scope"],
            "coordinate_system": "EPSG:4326 (WGS84), [longitude, latitude]",
            "stats": {
                "ride_edges": len(edges),
                "routes": len(routes),
                "stops": len(stops),
                "hubs": len(hubs),
                "interchanges": len(interchanges),
                "proximity_candidates": len(proximity),
                "external_flm_candidates": len(flm),
                "edges_with_trace": sum(1 for e in edges if e["trace"]),
                "publicly_enabled_edges": 0,
                **{f"mode_{k}": v for k, v in stats["mode_pattern_counts"].items()},
            },
            "policy": graph["policy"],
            "integrity": integrity,
            "notice": (
                "Historical 2022-11-24 to 2023-12-31 observations. No route is publicly enabled. "
                "Nothing here is a live travel instruction."
            ),
        },
        "hubs": hubs,
        "stops": stops,
        "routes": sorted(routes.values(), key=lambda r: r["name"]),
        "edges": edges,
        "interchanges": interchanges,
        "proximity": proximity,
        "flm": flm,
        "hubPairMatrix": matrix,
    }

    out = os.path.join(OUT_DIR, "graph.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(out)
    print(f"wrote {out} ({size/1024:.0f} KB)")
    print(f"  edges={len(edges)} routes={len(routes)} stops={len(stops)} hubs={len(hubs)}")
    print(f"  traces={sum(1 for e in edges if e['trace'])} interchanges={len(interchanges)} prox={len(proximity)} flm={len(flm)}")
    print(f"  publicly enabled edges: 0")


if __name__ == "__main__":
    main()
