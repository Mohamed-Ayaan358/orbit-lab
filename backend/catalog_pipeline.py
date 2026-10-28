"""Immutable raw snapshot -> normalized Parquet + quality report, with provenance."""
import argparse,datetime as dt,hashlib,json,os,tempfile
from pathlib import Path
import numpy as np
import pandas as pd

def ingest(catalog_dir,output):
    catalog_dir=Path(catalog_dir);output=Path(output);manifest=json.loads((catalog_dir/'manifest.json').read_text());records=[];seen=set();duplicates=0
    source_root=catalog_dir.parents[1]
    for group in manifest['groups']:
        if 'file' not in group:continue
        path=source_root/group['file'];raw=path.read_bytes();digest=hashlib.sha256(raw).hexdigest()
        if group.get('sha256') and digest!=group['sha256']:raise ValueError('Raw snapshot checksum mismatch')
        for row in json.loads(raw):
            identifier=int(row['NORAD_CAT_ID'])
            if identifier in seen:duplicates+=1;continue
            seen.add(identifier)
            records.append({'catalog_id':identifier,'name':row.get('OBJECT_NAME',''),'class':'active' if group['group']=='active' else 'debris',
                'group':group['group'],'element_epoch':row['EPOCH'],'retrieved_utc':group['retrieved_utc'],
                'mean_motion':float(row['MEAN_MOTION']),'eccentricity':float(row['ECCENTRICITY']),'inclination':float(row['INCLINATION']),
                'raan':float(row['RA_OF_ASC_NODE']),'argument_of_pericenter':float(row['ARG_OF_PERICENTER']),'mean_anomaly':float(row['MEAN_ANOMALY']),
                'source_url':group['source'],'source_sha256':digest})
    frame=pd.DataFrame(records)
    if frame.empty:raise ValueError('No catalog records')
    for key in ['mean_motion','eccentricity','inclination','raan','argument_of_pericenter','mean_anomaly']:
        if not np.isfinite(frame[key]).all():raise ValueError('Nonfinite catalog element')
    if not (frame.mean_motion.gt(0)&frame.eccentricity.between(0,1,inclusive='left')).all():raise ValueError('Invalid orbital elements')
    snapshot=manifest.get('snapshot_id') or hashlib.sha256(json.dumps(manifest,sort_keys=True).encode()).hexdigest()[:16]
    day=pd.to_datetime(frame.retrieved_utc,utc=True).max().strftime('%Y-%m-%d');target=output/f'date={day}'/f'snapshot={snapshot}'
    if target.exists():return json.loads((target/'_quality.json').read_text())|{'cached':True}
    target.parent.mkdir(parents=True,exist_ok=True);temp=Path(tempfile.mkdtemp(dir=target.parent,prefix='.staging-'))
    reference=pd.to_datetime(frame.retrieved_utc,utc=True);epochs=pd.to_datetime(frame.element_epoch,utc=True)
    ages=(reference-epochs).dt.total_seconds()/86400
    report={'snapshot':snapshot,'date':day,'rows':len(frame),'duplicate_ids_removed':duplicates,'classes':frame['class'].value_counts().to_dict(),
        'older_than_14_days':int((ages>14).sum()),'future_element_epochs':int((ages<0).sum()),'epoch_min':str(epochs.min()),'epoch_max':str(epochs.max()),'calibration_status':'catalog quality checks only; no physical calibration'}
    for kind,part in frame.groupby('class'):
        folder=temp/f'class={kind}';folder.mkdir();part.drop(columns='class').to_parquet(folder/'part-000.parquet',index=False)
    (temp/'_quality.json').write_text(json.dumps(report,indent=2));os.replace(temp,target)
    return report
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--catalog-dir',default='data/catalog');p.add_argument('--output',default='.state/lake/catalog');a=p.parse_args();print(json.dumps(ingest(a.catalog_dir,a.output),indent=2))
