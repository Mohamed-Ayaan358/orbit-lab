"""Cold-start measurements on this machine, not extrapolated cluster speedups."""
import argparse,json,os,subprocess,sys,tempfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
    p=argparse.ArgumentParser();p.add_argument('--output',default='benchmark-results');p.add_argument('--runs',type=int,nargs='+',default=[10000,100000]);a=p.parse_args();out=Path(a.output).absolute();out.mkdir(parents=True,exist_ok=True)
    bundle=out/'backend.zip'
    with zipfile.ZipFile(bundle,'w') as z:
        for f in (ROOT/'backend').glob('*.py'):z.write(f,'backend/'+f.name)
    reports=[];env=os.environ.copy();env['PYSPARK_PYTHON']=sys.executable;env['PYSPARK_DRIVER_PYTHON']=sys.executable;env['SPARK_LOCAL_IP']='127.0.0.1'
    for runs in a.runs:
        for cores in [1,2]:
            report=out/f'run-{runs}-cores-{cores}.json';target=out/f'outcomes-{runs}-cores-{cores}'
            command=[sys.executable,'-m','backend.spark_batch','--master',f'local[{cores}]','--runs',str(runs),'--partitions',str(cores*2),'--output',str(target),'--report',str(report)]
            with (out/f'run-{runs}-cores-{cores}.log').open('w') as log:subprocess.run(command,cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
            data=json.loads(report.read_text());assert data['summary']['runs']==runs;reports.append(data);print(f'{runs} runs / {cores} cores: {data["compute_write_read_seconds"]}s',flush=True)
    result={'measurements':reports,'scope':'Cold Spark jobs, single machine, one observation per configuration. Includes compute, writing and reading. No claimed multi-node speedup.'}
    (out/'benchmark.json').write_text(json.dumps(result,indent=2))
if __name__=='__main__':main()
