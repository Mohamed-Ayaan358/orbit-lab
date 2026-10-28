"""Atomic, cached CelesTrak refresh. Never discard the last good snapshot on failure."""
from __future__ import annotations
import argparse,datetime as dt,hashlib,json,math,os,tempfile,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
GROUPS=['active','fengyun-1c-debris','cosmos-2251-debris','iridium-33-debris']
def atomic_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(path.suffix+'.tmp');temp.write_text(json.dumps(data,indent=2));os.replace(temp,path)
def validate(rows):
    if not isinstance(rows,list) or not rows:raise ValueError('Empty or invalid catalog')
    seen=set()
    for row in rows:
        identifier=int(row['NORAD_CAT_ID'])
        if identifier in seen:raise ValueError('Duplicate NORAD ID in one group')
        seen.add(identifier);dt.datetime.fromisoformat(row['EPOCH'])
        for key in ['MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY']:
            if not math.isfinite(float(row[key])):raise ValueError('Non-finite orbital element')
        if float(row['MEAN_MOTION'])<=0 or not 0<=float(row['ECCENTRICITY'])<1:raise ValueError('Invalid mean motion/eccentricity')
    return len(seen)
def refresh(directory,*,fetch=None,now=None,min_hours=2):
    now=now or dt.datetime.now(dt.timezone.utc);directory=Path(directory);directory.mkdir(parents=True,exist_ok=True)
    previous=json.loads((directory/'manifest.json').read_text()) if (directory/'manifest.json').exists() else None
    dates=[g.get('retrieved_utc') for g in (previous or {}).get('groups',[]) if g.get('retrieved_utc')]
    if dates and (now-max(dt.datetime.fromisoformat(x) for x in dates)).total_seconds()<min_hours*3600:
        return {'status':'cached','checked_utc':now.isoformat()}
    def download(url):
        request=urllib.request.Request(url,headers={'User-Agent':'OrbitLabResearch/3.0 (+https://github.com/Mohamed-Ayaan358/orbit-lab)'})
        with urllib.request.urlopen(request,timeout=45) as response:
            if response.status!=200:raise ValueError(f'HTTP {response.status}; stopping refresh')
            return response.read()
    fetch=fetch or download;entries=[];payloads={}
    try:
        for group in GROUPS:
            url=f'https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT=json'
            raw=fetch(url);rows=json.loads(raw);count=validate(rows)
            content=json.dumps(rows,separators=(',',':')).encode();payloads[group]=content
            entries.append({'group':group,'file':f'./data/catalog/{group}.json','count':count,'source':url,'retrieved_utc':now.isoformat(),'epoch_min':min(r['EPOCH'] for r in rows),'epoch_max':max(r['EPOCH'] for r in rows),'sha256':hashlib.sha256(content).hexdigest()})
    except Exception as error:
        # CelesTrak asks clients to stop on HTTP errors; do not retry the other groups.
        atomic_json(directory/'refresh-status.json',{'status':'failed','checked_utc':now.isoformat(),'error':str(error),'last_good_preserved':bool(previous)})
        raise
    # Publish complete generations into a unique folder; manifest is the atomic switch.
    stamp=now.strftime('%Y%m%dT%H%M%SZ');generation=directory/'snapshots'/stamp;generation.mkdir(parents=True,exist_ok=False)
    for group,raw in payloads.items():(generation/f'{group}.json').write_bytes(raw)
    for entry in entries:entry['file']=f'./data/catalog/snapshots/{stamp}/{entry["group"]}.json'
    manifest={'groups':entries,'snapshot_id':stamp,'note':'Selected public groups, not all objects in space. Snapshot, not live tracking.'}
    atomic_json(directory/'manifest.json',manifest)
    history=json.loads((directory/'history.json').read_text()) if (directory/'history.json').exists() else []
    history.append({'snapshot_id':stamp,'retrieved_utc':now.isoformat(),'counts':{g['group']:g['count'] for g in entries}})
    atomic_json(directory/'history.json',history[-365:]);atomic_json(directory/'refresh-status.json',{'status':'ok','checked_utc':now.isoformat(),'snapshot_id':stamp})
    # Keep two raw generations for rollback; compact history is retained separately.
    import shutil
    for old in sorted((directory/'snapshots').iterdir())[:-2]:shutil.rmtree(old)
    return {'status':'ok','snapshot_id':stamp,'counts':history[-1]['counts']}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--directory',type=Path,default=ROOT/'data/catalog');args=parser.parse_args();print(json.dumps(refresh(args.directory),indent=2))
