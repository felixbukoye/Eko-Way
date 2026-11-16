-- Lagos Transit Navigator — starter PostgreSQL/PostGIS schema
-- Coordinates use WGS84 (EPSG:4326). All route observations remain historical until verified.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS transit_stop (
  stop_id TEXT PRIMARY KEY,
  stop_name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  service_hub TEXT,
  is_supporting_interchange BOOLEAN DEFAULT FALSE,
  source_period TEXT,
  evidence_status TEXT NOT NULL,
  geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS
    (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED
);
CREATE INDEX IF NOT EXISTS transit_stop_geom_gix ON transit_stop USING GIST (geom);

CREATE TABLE IF NOT EXISTS transit_route_pattern (
  edge_id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  route_name TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  trip_direction TEXT,
  from_stop_id TEXT NOT NULL REFERENCES transit_stop(stop_id),
  to_stop_id TEXT NOT NULL REFERENCES transit_stop(stop_id),
  operating_days_historical TEXT,
  operating_start_historical TIME,
  operating_end_historical TIME,
  observed_duration_median_min DOUBLE PRECISION,
  duration_sample_count INTEGER,
  shape_distance_m DOUBLE PRECISION,
  sample_trip_count INTEGER,
  evidence_status TEXT NOT NULL,
  public_routing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  regulatory_review_required BOOLEAN NOT NULL DEFAULT FALSE,
  source_feed_period TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transit_route_pattern_stop (
  edge_id TEXT NOT NULL REFERENCES transit_route_pattern(edge_id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL,
  stop_id TEXT NOT NULL REFERENCES transit_stop(stop_id),
  observed_arrival TEXT,
  observed_departure TEXT,
  role_in_trip TEXT NOT NULL,
  board_alight_permission TEXT NOT NULL DEFAULT 'not_in_source_data',
  PRIMARY KEY(edge_id, sequence_no)
);

-- Preserve each recorded trip's actual LineString; one route pattern can have several traces.
CREATE TABLE IF NOT EXISTS transit_route_trace (
  trace_id TEXT PRIMARY KEY,
  edge_id TEXT NOT NULL REFERENCES transit_route_pattern(edge_id) ON DELETE CASCADE,
  source_trip_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  trip_direction TEXT,
  source_feed_period TEXT NOT NULL,
  evidence_status TEXT NOT NULL DEFAULT 'historical_unverified',
  public_routing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  geom GEOMETRY(LineString, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS transit_route_trace_geom_gix ON transit_route_trace USING GIST (geom);

CREATE TABLE IF NOT EXISTS candidate_transfer (
  transfer_id BIGSERIAL PRIMARY KEY,
  from_stop_id TEXT NOT NULL REFERENCES transit_stop(stop_id),
  to_stop_id TEXT NOT NULL REFERENCES transit_stop(stop_id),
  distance_m DOUBLE PRECISION NOT NULL,
  transfer_status TEXT NOT NULL DEFAULT 'unverified_not_enabled_by_default',
  source_method TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS external_route_candidate (
  candidate_id TEXT PRIMARY KEY,
  from_place TEXT NOT NULL,
  to_place TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  evidence_status TEXT NOT NULL,
  exact_stop_ids_available BOOLEAN NOT NULL DEFAULT FALSE,
  current_service_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  public_routing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT
);
