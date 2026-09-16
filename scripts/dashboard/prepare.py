"""Run with Python + pyarrow: prepare.py green.parquet zones.csv.
Source files: https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page
"""
import csv
import hashlib
import json
import sys
from pathlib import Path
import pyarrow.parquet as pq

source, lookup = map(Path, sys.argv[1:])
raw = pq.read_table(source).to_pylist()
trips = []
for index, row in enumerate(raw):
    pickup, dropoff = row['lpep_pickup_datetime'], row['lpep_dropoff_datetime']
    if pickup is None or dropoff is None:
        continue
    if not '2025-01-01' <= pickup.isoformat() < '2025-01-08':
        continue
    duration = (dropoff - pickup).total_seconds() / 60
    distance, fare = row['trip_distance'], row['fare_amount']
    if not (0 < duration <= 180 and distance is not None and 0 < distance <= 100 and fare is not None and 0 < fare <= 500):
        continue
    trips.append(dict(id=index + 1, pickup=pickup.isoformat(), day=pickup.day,
                      zoneId=row['PULocationID'], dropoffZoneId=row['DOLocationID'],
                      miles=distance, minutes=round(duration, 2), fareCents=round(fare * 100)))
trips.sort(key=lambda trip: (trip['pickup'], trip['id']))
with lookup.open() as file:
    zones = [dict(id=int(row['LocationID']), name=row['Zone'], borough=row['Borough']) for row in csv.DictReader(file)]
payload = dict(trips=trips, zones=zones)
out = Path('public/data/dashboard')
out.mkdir(parents=True, exist_ok=True)
encoded = json.dumps(payload, separators=(',', ':'), ensure_ascii=False).encode()
(out / 'green-2025-week1.v1.json').write_bytes(encoded)
manifest = dict(source='https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page',
    parquet='https://d37ci6vzurychx.cloudfront.net/trip-data/green_tripdata_2025-01.parquet',
    sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    lookupSha256=hashlib.sha256(lookup.read_bytes()).hexdigest(),
    snapshotSha256=hashlib.sha256(encoded).hexdigest(), bytes=len(encoded),
    sourceRows=len(raw), trips=len(trips), fareCents=sum(t['fareCents'] for t in trips),
    dailyCounts=[sum(t['day'] == day for t in trips) for day in range(1, 8)],
    rules='Pickups Jan 1-7 2025, NYC local wall time. Duration (0,180] minutes, distance (0,100] miles, base fare (0,500] USD. No sampling. ID is 1-based source row. Fare excludes tips, taxes and surcharges. No deduplication or claim of representativeness.')
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
