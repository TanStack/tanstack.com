import json
import re
import subprocess
import tempfile
import time
from pathlib import Path

origins = {
    'unified': 'https://tanstack-perf-stage-baseline.thetanstack.workers.dev',
    'split': 'https://tanstack-perf-stage-site.thetanstack.workers.dev',
}
records = []
with tempfile.TemporaryDirectory() as directory:
    headers = Path(directory) / 'headers'
    for index in range(40):
        order = list(origins) if index % 2 == 0 else list(reversed(origins))
        for kind in order:
            url = origins[kind] + '/query/latest/docs/framework/react/overview'
            result = subprocess.run([
                'curl', '-sS', '--max-time', '45', '-D', str(headers), '-o', '/dev/null',
                '-w', '%{json}', url,
            ], capture_output=True, text=True, check=True)
            timing = json.loads(result.stdout)
            text = headers.read_text()
            server = re.search(r'(?im)^server-timing:\s*(.*)', text)
            counter = re.search(r'docs_request;desc="(\d+)"', server.group(1)) if server else None
            ray = re.search(r'(?im)^cf-ray:\s*(.*)', text)
            record = {
                'kind': kind, 'sample': index, 'status': timing['http_code'],
                'ttfb_ms': timing['time_starttransfer'] * 1000,
                'after_connection_ms': (timing['time_starttransfer'] - timing['time_appconnect']) * 1000,
                'total_ms': timing['time_total'] * 1000,
                'docs_request': int(counter.group(1)) if counter else None,
                'server_timing': server.group(1).strip() if server else None,
                'ray': ray.group(1).strip() if ray else None,
            }
            records.append(record)
            print(json.dumps(record), flush=True)
            if record['status'] != 200:
                raise RuntimeError('Docs failed, refusing to report a performance comparison')
            time.sleep(0.25)
Path('staging/measurements.json').write_text(json.dumps(records, indent=2) + '\n')
