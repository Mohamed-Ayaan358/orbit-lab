"""Optional Spark extension; submit backend.zip with --py-files on a configured cluster."""
import argparse
from pyspark.sql import SparkSession,types as T,functions as F
from backend.batch import batches,run_batch

def compute_partition(specs):
    for index,count in specs:yield from run_batch(index,count)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--runs',type=int,default=1000000);p.add_argument('--batch-size',type=int,default=1000);p.add_argument('--output',required=True);p.add_argument('--partitions',type=int,default=100);a=p.parse_args()
    spark=SparkSession.builder.appName('OrbitLabEnsembles').getOrCreate()
    specs=list(batches(a.runs,a.batch_size))
    rdd=spark.sparkContext.parallelize(specs,min(a.partitions,len(specs))).mapPartitions(compute_partition)
    schema=T.StructType([T.StructField(k,T.LongType(),False) for k in ['batch','run','debris','satellites','seed','year']])
    df=spark.createDataFrame(rdd,schema)
    # Workers write run outcomes to shared storage; never collect all runs on the driver.
    df.write.mode('errorifexists').partitionBy('batch').parquet(a.output)
    saved=spark.read.parquet(a.output)
    saved.agg(F.count('*').alias('runs'),F.avg('debris').alias('mean_debris'),F.stddev('debris').alias('std_debris'),F.expr('percentile_approx(debris, array(0.025,0.5,0.975))').alias('debris_quantiles')).show(truncate=False)
    spark.stop()
