#!/usr/bin/env python3
"""Research-mode path finder for Lagos MVP historical route graph.

By default, no journeys are returned because all supplied route records are historical and
unverified. Use --research-mode to inspect candidate paths. Proximity transfers are opt-in and
remain marked unverified.
"""
import argparse, heapq, json, sys, itertools
from pathlib import Path

def load_graph(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))

def find_routes(graph, start_hub, end_hub, limit=3, objective='fastest', allow_proximity=False, max_legs=4):
    nodes = {n['node_id']: n for n in graph['nodes']}
    start_nodes = [n['node_id'] for n in graph['nodes'] if (n.get('service_hub') or '').lower() == start_hub.lower()]
    end_nodes = {n['node_id'] for n in graph['nodes'] if (n.get('service_hub') or '').lower() == end_hub.lower()}
    if not start_nodes or not end_nodes:
        return []
    rides = {}
    for e in graph['ride_edges']:
        rides.setdefault(e['from_node'], []).append(e)
    transfers = {}
    if allow_proximity:
        for t in graph['proximity_transfer_candidates']:
            transfers.setdefault(t['from_node'], []).append(t)
            rev = dict(t); rev['from_node'], rev['to_node'] = t['to_node'], t['from_node']
            rev['from_stop_name'], rev['to_stop_name'] = t['to_stop_name'], t['from_stop_name']
            transfers.setdefault(rev['from_node'], []).append(rev)
    # Exact same stop IDs are already shared graph nodes; no artificial transfer edge is required.
    heap = []
    serial = itertools.count()
    for s in start_nodes:
        heapq.heappush(heap, (0.0, next(serial), 0, s, [], [s]))
    results = []
    seen_signatures = set()
    max_expansions = 250000
    expansions = 0
    while heap and len(results) < limit and expansions < max_expansions:
        cost, _, ride_count, node_id, legs, visited = heapq.heappop(heap)
        expansions += 1
        if node_id in end_nodes and legs:
            signature = tuple((x.get('edge_id'), x.get('transfer_type')) for x in legs)
            if signature not in seen_signatures:
                seen_signatures.add(signature)
                results.append({
                    'start_hub': start_hub, 'end_hub': end_hub,
                    'origin_stop': nodes[visited[0]]['stop_name'], 'destination_stop': nodes[node_id]['stop_name'],
                    'objective': objective, 'score': round(cost, 2), 'ride_legs': sum(1 for x in legs if x['type']=='ride'),
                    'transfers': max(0, sum(1 for x in legs if x['type']=='ride') - 1),
                    'walking_transfer_segments': sum(1 for x in legs if x['type']=='transfer'), 'legs': legs,
                    'evidence_status': 'historical_unverified_research_only',
                    'public_directions_allowed': False,
                    'warning': 'Historical 2022–2023 route observations. Do not use as live travel instructions until route, boarding/alighting, transfer, legality and fares are independently verified.'
                })
            continue
        if sum(1 for x in legs if x['type']=='ride') >= max_legs:
            continue
        # Ride candidates from the current terminal.
        for e in rides.get(node_id, []):
            nxt = e['to_node']
            if nxt in visited:
                continue
            dur = e.get('observed_duration_median_min')
            if dur is None:
                dur = (e.get('shape_distance_m') or 0) / 180.0 # explicitly a fallback speed prior, not observed
                dur_kind = 'rough_distance_fallback_not_observed'
            else:
                dur_kind = 'historical_observed_median'
            if objective == 'fewest_transfers':
                step_cost = 1.0 + (float(dur) / 10000.0)
            else:
                step_cost = float(dur)
            leg = {
                'type': 'ride', 'edge_id': e['edge_id'], 'route_id': e['route_id'], 'route_name': e['route_name'],
                'vehicle_type': e['vehicle_type'], 'from_stop': e['from_stop_name'], 'to_stop': e['to_stop_name'],
                'historical_duration_min': e.get('observed_duration_median_min'),
                'duration_basis': dur_kind, 'intermediate_stops': [s['stop_name'] for s in e['stop_sequence'][1:-1]],
                'source_period': e['source_feed_period'], 'status': e['evidence_status'],
                'regulatory_review_required': e.get('regulatory_review_required', False)
            }
            heapq.heappush(heap, (cost+step_cost, next(serial), ride_count+1, nxt, legs+[leg], visited+[nxt]))
        # Optional approximate transfer nodes; never active by default.
        for t in transfers.get(node_id, []):
            nxt = t['to_node']
            if nxt in visited:
                continue
            step_cost = float(t['estimated_walk_min_at_4kmh'])
            leg = {'type':'transfer', 'from_stop':t['from_stop_name'], 'to_stop':t['to_stop_name'],
                   'straight_line_distance_m':t['distance_m'], 'estimated_walk_min':t['estimated_walk_min_at_4kmh'],
                   'status':'unverified_candidate_walk_transfer'}
            heapq.heappush(heap, (cost+step_cost, next(serial), ride_count, nxt, legs+[leg], visited+[nxt]))
    return results

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--graph', default=str(Path(__file__).with_name('route_graph.json')))
    ap.add_argument('--from-hub', required=True)
    ap.add_argument('--to-hub', required=True)
    ap.add_argument('--limit', type=int, default=3)
    ap.add_argument('--objective', choices=['fastest','fewest_transfers'], default='fastest')
    ap.add_argument('--research-mode', action='store_true', help='Allow historical unverified records for research output only')
    ap.add_argument('--allow-proximity-transfers', action='store_true', help='Include unverified straight-line transfer candidates')
    args=ap.parse_args()
    graph=load_graph(args.graph)
    if not args.research_mode:
        print(json.dumps({'routes':[], 'message':'No currently verified route edges are enabled. Use --research-mode to inspect historical candidates.'}, indent=2))
        return
    routes=find_routes(graph,args.from_hub,args.to_hub,args.limit,args.objective,args.allow_proximity_transfers)
    print(json.dumps({'routes':routes,'research_mode':True,'proximity_transfers_enabled':args.allow_proximity_transfers},indent=2,ensure_ascii=False))

if __name__=='__main__': main()
