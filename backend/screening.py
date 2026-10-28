"""Coarse public-catalog near-approach screening, NOT operational conjunction assessment."""
import datetime as dt,json,math
from pathlib import Path
import numpy as np
from sgp4.api import Satrec,SatrecArray,jday
from sgp4 import omm
R=6378.137;MU=398600.4418

def catalog_root(default):
    import os
    configured=Path(os.environ.get('ORBIT_STATE_DIR',str(Path(default).parents[1]/'.state')))/'catalog'
    return configured if (configured/'manifest.json').exists() else Path(default)
def group_path(directory,group):
    path=Path(group['file']);parts=path.parts
    return Path(directory)/Path(*parts[2:]) if parts[:2]==('data','catalog') else Path(directory)/path.name

def screen(directory,config):
    directory=catalog_root(directory);manifest=json.loads((directory/'manifest.json').read_text());records=[];seen=set()
    for group in manifest['groups']:
        if not group.get('file') or (config['group']=='debris' and group['group']=='active'):continue
        for row in json.loads(group_path(directory,group).read_text()):
            if row['NORAD_CAT_ID'] not in seen:records.append(row);seen.add(row['NORAD_CAT_ID'])
    selected=records[::max(1,len(records)//config['limit'])][:config['limit']]
    recs=[];usable=[]
    for row in selected:
        try:
            rec=Satrec();omm.initialize(rec,row|{'CENTER_NAME':'EARTH','REF_FRAME':'TEME','TIME_SYSTEM':'UTC','MEAN_ELEMENT_THEORY':'SGP4'});recs.append(rec);usable.append(row)
        except (ValueError,KeyError):continue
    if not recs:raise ValueError('No usable orbital elements')
    reference=dt.datetime.fromisoformat(config['reference_utc'].replace('Z','+00:00'));start=reference+dt.timedelta(seconds=config['epoch_seconds'])
    seconds=np.arange(0,config['hours']*3600+1,config['step_s'],dtype=float)
    days=[];fractions=[]
    for sec in seconds:
        t=start+dt.timedelta(seconds=float(sec));jd,fr=jday(t.year,t.month,t.day,t.hour,t.minute,t.second+t.microsecond/1e6);days.append(jd);fractions.append(fr)
    errors,positions,_=SatrecArray(recs).sgp4(np.array(days),np.array(fractions))
    # Fictional circular orbit, expressed in the snapshot-aligned scene frame then rotated to TEME-like axes.
    jd,fr=jday(reference.year,reference.month,reference.day,reference.hour,reference.minute,reference.second)
    from sgp4.propagation import gstime
    gst=gstime(jd+fr);radius=R+config['altitude'];inc=math.radians(config['inclination']);node=config['raan'];phase=config['phase']+(seconds+config['epoch_seconds'])*math.sqrt(MU/radius**3)
    x=radius*(math.cos(node)*np.cos(phase)-math.sin(node)*np.sin(phase)*math.cos(inc));y=radius*np.sin(phase)*math.sin(inc);z=-radius*(math.sin(node)*np.cos(phase)+math.cos(node)*np.sin(phase)*math.cos(inc))
    parent=np.stack([math.cos(gst)*x+math.sin(gst)*z,math.sin(gst)*x-math.cos(gst)*z,y],axis=1)
    distances=np.linalg.norm(positions-parent[None,:,:],axis=2);distances[(errors!=0)|(~np.isfinite(distances))]=np.inf
    best=distances.min(axis=1);order=np.argsort(best)[:10];results=[]
    for index in order:
        if not np.isfinite(best[index]):continue
        at=int(distances[index].argmin());results.append({'catalog_id':int(usable[index]['NORAD_CAT_ID']),'name':usable[index].get('OBJECT_NAME',''),'sampled_distance_km':float(best[index]),'time_utc':(start+dt.timedelta(seconds=float(seconds[at]))).isoformat(),'element_epoch':usable[index]['EPOCH']})
    return {'screened_objects':len(recs),'available_selected_group_objects':len(records),'sample_spacing_seconds':config['step_s'],'hours':config['hours'],'closest_sampled_approaches':results,
      'scope':'Coarse sampled distances for the fictional mission, not true closest-approach minima or collision probabilities. May miss encounters between samples. Public mean elements lack covariance; no maneuver or precision Earth-orientation model.'}
