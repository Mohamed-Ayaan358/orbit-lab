"""Validate included catalog JSON and record snapshot counts."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'data/catalog/manifest.json').read_text())
seen=set();counts={};raw=0
for group in manifest['groups']:
    if 'file' not in group:continue
    rows=json.loads((ROOT/group['file']).read_text());assert len(rows)==group['count']
    assert all(all(key in row for key in ['NORAD_CAT_ID','EPOCH','MEAN_MOTION','INCLINATION','ECCENTRICITY']) for row in rows)
    counts[group['group']]=len(rows);raw+=len(rows)
    seen.update(row['NORAD_CAT_ID'] for row in rows)
print(json.dumps({'groups':counts,'raw_records':raw,'unique_catalog_ids':len(seen)},indent=2))
