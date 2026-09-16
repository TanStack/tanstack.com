CREATE SCHEMA IF NOT EXISTS dashboard;
CREATE TABLE IF NOT EXISTS dashboard.zones (
  id integer PRIMARY KEY,
  name text NOT NULL,
  borough text NOT NULL
);
CREATE TABLE IF NOT EXISTS dashboard.trips (
  id integer PRIMARY KEY,
  pickup text NOT NULL,
  day integer NOT NULL CHECK (day BETWEEN 1 AND 7),
  "zoneId" integer NOT NULL REFERENCES dashboard.zones(id),
  "dropoffZoneId" integer NOT NULL,
  miles double precision NOT NULL,
  minutes double precision NOT NULL,
  "fareCents" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS trips_pickup_id ON dashboard.trips(pickup, id);
CREATE INDEX IF NOT EXISTS trips_day_zone ON dashboard.trips(day, "zoneId");
CREATE INDEX IF NOT EXISTS trips_zone_pickup ON dashboard.trips("zoneId", pickup, id);
CREATE INDEX IF NOT EXISTS zones_borough ON dashboard.zones(borough, id);
