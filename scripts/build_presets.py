from pathlib import Path
import json,itertools,sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from backend.app import Scenario
from backend.engine import run_scenario
out={}
for i,(L,P,K) in enumerate(itertools.product([40,120,240],[.6,.9,.99],[0.,.4,1.2])):
 cfg=Scenario(annual_launches=L,disposal=P,collision_coefficient=K,seed=20261027+i).model_dump()
 out[f'{L}_{P}_{K}']=run_scenario(cfg)
(ROOT/'data/presets.json').write_text(json.dumps(out,separators=(',',':')))
parts=[{'scenario':p.parent.name.split('=')[1],'file':str(p.relative_to(ROOT))} for p in sorted((ROOT/'data/ensemble').rglob('*.parquet'))]
(ROOT/'data/ensemble/_manifest.json').write_text(json.dumps({'rows':418500,'scenarios':27,'runs_per_scenario':500,'snapshots_per_run':31,'kind':'synthetic teaching population model','files':parts},indent=2))
print('Presets:',len(out))
