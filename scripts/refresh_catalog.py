"""Fetch each CelesTrak group once; cache successful responses and keep provenance."""
import json,subprocess,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
GROUPS=['active','fengyun-1c-debris','cosmos-2251-debris','iridium-33-debris']
entries=[]
for group in GROUPS:
 url=f'https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT=json'
 dest=ROOT/'data/catalog'/f'{group}.json'
 result=subprocess.run(['curl','--fail','--silent','--show-error','--location','--max-time','45',url],capture_output=True)
 try:
  if result.returncode:raise ValueError(result.stderr.decode()[:200])
  rows=json.loads(result.stdout)
  if not isinstance(rows,list) or not rows:raise ValueError('Empty or invalid catalog')
  dest.write_text(json.dumps(rows,separators=(',',':')))
  entries.append({'group':group,'file':f'./data/catalog/{group}.json','count':len(rows),'source':url,'retrieved_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'epoch_min':min(r['EPOCH'] for r in rows),'epoch_max':max(r['EPOCH'] for r in rows)})
  print(group,len(rows))
 except (ValueError,KeyError) as e:
  entries.append({'group':group,'source':url,'error':str(e)}); print(group,'UNAVAILABLE',str(e))
(ROOT/'data/catalog/manifest.json').write_text(json.dumps({'groups':entries,'note':'Selected public groups, not all objects in space. Positions are propagated at the snapshot reference epoch, not live tracking.'},indent=2))
