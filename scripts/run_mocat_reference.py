"""Reproduce a numerical pySSEM smoke test on an explicitly synthetic fixture."""
from pathlib import Path
import json,os,time
import numpy as np,pandas as pd
import argparse,subprocess
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',default='.science/mocat-reference');args=p.parse_args()
source=Path(args.source).resolve();out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
commit=subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD']).decode().strip()
assert commit=='21763efaafcd191942e2ae84db9ec86ae3b392e6','Use the verified upstream commit.'
data=out/'pyssem/utils/launch/data';data.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(42);rows=[]
for kind,count,mass,area in [('S',100,200,4.9),('N',300,.5,.049)]:
 for alt in rng.uniform(400,1100,count):rows.append({'sma [m]':(6378.137+alt)*1000,'ecc [-]':0.,'mass [kg]':mass,'area [m^2]':area,'date [-]':'2024-01-01','species_class':kind})
pd.DataFrame(rows).to_csv(data/'ex1_intact_objs_nfl_w_debris_new_v2_2025_N.csv',index=False)
config=json.loads((source/'pyssem/simulation_configurations/three_species.json').read_text());p=config['scenario_properties'];p.update(simulation_duration=10,steps=11,n_shells=6,baseline=True,fragment_spreading=False,parallel_processing=False,launch_scenario='workshop_nfl',indicator_variables=[])
from pyssem.model import Model
os.chdir(out);begin=time.perf_counter();model=Model(**p);model.configure_species(config['species']);model.run_model();props=model.scenario_properties
assert props.output.success
Y=props.output.y;assert np.isfinite(Y).all();assert Y.min()>-1e-4
names=props.species_names;totals=Y.reshape((len(names),props.n_shells,-1)).sum(axis=1)
result={'model':'MOCAT-pySSEM','upstream_commit':'21763efaafcd191942e2ae84db9ec86ae3b392e6','scope':'Smoke test on synthetic 400-object fixture with assumed physical parameters; not calibrated to catalog or historical events','configuration':p,'species':names,'time_unit':'years','years':props.output.t.tolist(),'totals':{name:totals[i].tolist() for i,name in enumerate(names)},'elapsed_seconds':time.perf_counter()-begin,'minimum_population':float(Y.min())}
result['species_configuration']=config['species']
(out/'reference.json').write_text(json.dumps(result,indent=2));print('MOCAT_REFERENCE_SUCCESS',json.dumps(result)[-600:])
