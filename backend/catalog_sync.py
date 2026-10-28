"""Mirror the site's validated snapshot; preserve the previous generation on failure."""
import hashlib,json,os,shutil,urllib.request
from pathlib import Path,PurePosixPath
BASE='https://raw.githubusercontent.com/Mohamed-Ayaan358/orbit-lab/main/'
def read_url(url,limit):
    request=urllib.request.Request(url,headers={'User-Agent':'OrbitLabSnapshotMirror/3.0'})
    with urllib.request.urlopen(request,timeout=20) as response:
        data=response.read(limit+1)
    if len(data)>limit:raise ValueError('Snapshot file exceeds size limit')
    return data

def sync(directory,bundled):
    directory=Path(directory);current=directory/'manifest.json'
    previous=json.loads((current if current.exists() else Path(bundled)/'manifest.json').read_text())
    manifest=json.loads(read_url(BASE+'data/catalog/manifest.json',200000))
    if manifest.get('snapshot_id')==previous.get('snapshot_id') and manifest==previous:return {'status':'cached'}
    stage=directory/'.incoming';shutil.rmtree(stage,ignore_errors=True);stage.mkdir(parents=True)
    entries=[]
    try:
        for group in manifest['groups']:
            path=PurePosixPath(group['file'])
            if '..' in path.parts or path.parts[:2]!=('data','catalog') or path.suffix!='.json':raise ValueError('Unexpected source path')
            raw=read_url(BASE+str(path),30000000)
            if hashlib.sha256(raw).hexdigest()!=group['sha256']:raise ValueError('Snapshot checksum mismatch')
            rows=json.loads(raw)
            if len(rows)!=group['count'] or not rows:raise ValueError('Snapshot count mismatch')
            relative=Path(*path.parts[2:]);target=stage/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw);entries.append(relative)
        # Files have unique generation paths; publish the manifest last.
        for relative in entries:
            target=directory/relative;target.parent.mkdir(parents=True,exist_ok=True);os.replace(stage/relative,target)
        (stage/'manifest.json').write_text(json.dumps(manifest));os.replace(stage/'manifest.json',current)
        generations=directory/'snapshots'
        if generations.exists():
            for old in sorted(generations.iterdir())[:-2]:shutil.rmtree(old)
        return {'status':'updated','snapshot_id':manifest.get('snapshot_id')}
    finally:shutil.rmtree(stage,ignore_errors=True)
