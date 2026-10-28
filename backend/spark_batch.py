"""Execute bounded ensemble batches on Spark; all large outcomes stay in Parquet."""
import argparse,json,os,socket,time
from pathlib import Path
from pyspark import SparkConf
from pyspark.sql import SparkSession,types as T,functions as F
from backend.batch import batches,run_batch

def compute_partition(specs):
    import os,socket
    from pyspark import TaskContext
    for index,count,base in specs:
        for row in run_batch(index,count,base):
            yield row|{'worker_pid':os.getpid(),'worker_host':socket.gethostname(),'partition':TaskContext.get().partitionId()}

def main():
    p=argparse.ArgumentParser();p.add_argument('--runs',type=int,default=100000);p.add_argument('--batch-size',type=int,default=1000);p.add_argument('--output',required=True);p.add_argument('--partitions',type=int,default=4);p.add_argument('--master');p.add_argument('--config');p.add_argument('--report');a=p.parse_args()
    if a.runs<1 or a.batch_size<1 or a.partitions<1:p.error('Runs, batch size and partitions must be positive.')
    base=json.loads(Path(a.config).read_text()) if a.config else {}
    start=time.perf_counter()
    master=a.master or SparkConf().get('spark.master','local[2]')
    builder=SparkSession.builder.master(master).appName('OrbitLabEnsembles').config('spark.ui.enabled','false').config('spark.sql.shuffle.partitions',str(a.partitions))
    if master.startswith('local'):builder=builder.config('spark.driver.host','127.0.0.1')
    spark=builder.getOrCreate()
    spark.sparkContext.setLogLevel('ERROR');startup=time.perf_counter()-start;begin=time.perf_counter()
    specs=[(i,n,base) for i,n in batches(a.runs,a.batch_size)]
    rdd=spark.sparkContext.parallelize(specs,min(a.partitions,len(specs))).mapPartitions(compute_partition)
    schema=T.StructType([T.StructField(k,T.LongType(),False) for k in ['batch','run','debris','satellites','seed','year','worker_pid','partition']]+[T.StructField('worker_host',T.StringType(),False)])
    df=spark.createDataFrame(rdd,schema)
    df.write.mode('errorifexists').partitionBy('batch').parquet(a.output)
    saved=spark.read.parquet(a.output)
    summary=saved.agg(F.count('*').alias('runs'),F.avg('debris').alias('mean_debris'),F.stddev('debris').alias('std_debris'),F.expr('percentile_approx(debris, array(0.025,0.5,0.975), 10000)').alias('debris_quantiles')).first().asDict()
    workers=[r.asDict() for r in saved.select('worker_host','worker_pid').distinct().limit(32).collect()]
    report={'master':master,'spark_version':spark.version,'startup_seconds':round(startup,4),'compute_write_read_seconds':round(time.perf_counter()-begin,4),'summary':summary,'python_workers':workers,'partitions':a.partitions,'batch_size':a.batch_size,'config':base,'scope':'Local Spark execution on one physical host; not a multi-host scaling claim' if master.startswith('local') else 'Spark master specified by operator; inspect worker hosts for placement'}
    print(json.dumps(report,indent=2))
    if a.report:Path(a.report).write_text(json.dumps(report,indent=2))
    spark.stop()
if __name__=='__main__':main()
