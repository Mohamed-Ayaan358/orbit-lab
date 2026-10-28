"""Seeded, bounded batches for offline experiments. Run with python -m backend.batch."""
import argparse,json
from pathlib import Path
from .schemas import Scenario
from .engine import run_scenario

def batches(total,size):
    if total<20 or size<20:raise ValueError('Use at least 20 runs per batch.')
    remaining=total;index=0
    while remaining:
        n=min(size,remaining)
        if n<20:raise ValueError('Choose a batch size that avoids a final batch below 20 runs.')
        yield index,n
        remaining-=n;index+=1

def run_batch(index,count,base=None):
    config=Scenario(**((base or {})|{'runs':count,'seed':20261027+index})).model_dump()
    result=run_scenario(config,include_runs=True)
    return [{'batch':index,'run':r['run'],'debris':r['debris'],'satellites':r['satellites'],'seed':config['seed'],'year':config['years']} for r in result['final_runs']]

def main():
    import pandas as pd
    parser=argparse.ArgumentParser();parser.add_argument('--runs',type=int,default=10000);parser.add_argument('--batch-size',type=int,default=1000);parser.add_argument('--output',default='results/local');args=parser.parse_args()
    output=Path(args.output);output.mkdir(parents=True,exist_ok=True)
    specs=list(batches(args.runs,args.batch_size))
    for index,count in specs:
        target=output/f'batch={index}';target.mkdir(exist_ok=True)
        pd.DataFrame(run_batch(index,count)).drop(columns='batch').to_parquet(target/'part.parquet',index=False)
    (output/'_manifest.json').write_text(json.dumps({'runs':args.runs,'batches':len(specs),'batch_size':args.batch_size,'kind':'synthetic final-run outcomes','seed_rule':'20261027 + batch index'},indent=2))
    print(f'Wrote {args.runs} outcomes across {len(specs)} batches to {output}')
if __name__=='__main__':main()
