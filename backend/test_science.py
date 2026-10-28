import datetime as dt,json,math,os,tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from .app import app,public_times
from .jobs import JobQueue
from .schemas import Scenario
from .compute import computation
from .conjunction import disk_probability
from .screening import screen
from scripts.refresh_catalog import refresh,GROUPS
ROOT=Path(__file__).resolve().parents[1]
class ScienceTests(unittest.TestCase):
 def test_gaussian_disk_analytic_limit_and_invalid_covariance(self):
  result=disk_probability(0,0,10000,0,10000,10)
  self.assertAlmostEqual(result['probability'],1-math.exp(-.005),places=10)
  self.assertAlmostEqual(disk_probability(100,0,1,0,1,1000)['probability'],1,places=10)
  self.assertAlmostEqual(disk_probability(100,0,10000,0,10000,10)['probability'],disk_probability(-100,0,10000,0,10000,10)['probability'],places=12)
  with self.assertRaises(ValueError):disk_probability(0,0,1,2,1,10)
 def test_shared_compute_lock(self):
  with computation():
   with self.assertRaises(RuntimeError):
    with computation():pass
 def test_persistent_queue_and_retention(self):
  with tempfile.TemporaryDirectory() as d:
   queue=JobQueue(d,max_pending=1);job=queue.submit(Scenario(runs=20,years=2).model_dump())
   with self.assertRaises(ValueError):queue.submit({})
   self.assertTrue(queue.work_one());saved=JobQueue(d).get(job['id'],True)
   self.assertEqual(saved['status'],'completed');self.assertEqual(saved['result']['run_count'],20)
 def test_api_access_bounds_and_job_lifecycle(self):
  with tempfile.TemporaryDirectory() as d,patch.dict(os.environ,{'ORBIT_STATE_DIR':d,'ORBIT_API_TOKEN':'test-secret','ORBIT_MAX_RUNS':'2000','ORBIT_MAX_RUN_YEARS':'100000'}):
   public_times.clear()
   with TestClient(app) as c:
    self.assertEqual(c.get('/').status_code,200)
    self.assertEqual(c.post('/api/jobs',json={}).status_code,401)
    self.assertEqual(c.post('/api/preview',json={'runs':501}).status_code,422)
    self.assertEqual(c.post('/api/preview',json={'runs':20,'years':2}).status_code,200)
    headers={'Authorization':'Bearer test-secret'}
    job=c.post('/api/jobs',headers=headers,json={'runs':20,'years':2}).json()
    for _ in range(50):
     out=c.get('/api/jobs/'+job['id'],headers=headers).json()
     if out['status']=='completed':break
     time.sleep(.02)
    self.assertEqual(out['status'],'completed')
    self.assertEqual(c.post('/api/screen',headers=headers,json={'reference_utc':'2026-10-28'}).status_code,422)
    for path in ['/deploy/.env','/deploy/compose.coolify.yml','/SCIENCE.md','/validation/../backend/app.py']:self.assertEqual(c.get(path).status_code,404)
 def test_real_sgp4_sample(self):
  config={'reference_utc':'2026-10-27T12:00:00+00:00','epoch_seconds':0,'altitude':550,'inclination':51.6,'raan':.4,'phase':.6,'hours':1,'step_s':600,'limit':20,'group':'debris'}
  with tempfile.TemporaryDirectory() as d,patch.dict(os.environ,{'ORBIT_STATE_DIR':d}):out=screen(ROOT/'data/catalog',config)
  self.assertGreater(out['screened_objects'],0);self.assertTrue(out['closest_sampled_approaches']);self.assertTrue(all(r['sampled_distance_km']>=0 for r in out['closest_sampled_approaches']))
 def test_atomic_refresh_and_error_preserves_last_good(self):
  source=json.loads((ROOT/'data/catalog/active.json').read_text())[:2];now=dt.datetime(2026,10,28,tzinfo=dt.timezone.utc)
  with tempfile.TemporaryDirectory() as d:
   directory=Path(d);calls=[]
   def fetch(url):calls.append(url);return json.dumps(source).encode()
   self.assertEqual(refresh(directory,fetch=fetch,now=now)['status'],'ok');self.assertEqual(len(calls),4)
   manifest=(directory/'manifest.json').read_bytes()
   refresh(directory,fetch=lambda _:self.fail('Cached refresh fetched data'),now=now+dt.timedelta(hours=1))
   calls.clear()
   def fail(url):calls.append(url);raise ValueError('HTTP 503')
   with self.assertRaises(ValueError):refresh(directory,fetch=fail,now=now+dt.timedelta(hours=3))
   self.assertEqual(len(calls),1);self.assertEqual((directory/'manifest.json').read_bytes(),manifest)
 def test_catalog_lake_checksums_and_cached_ingestion(self):
  from .catalog_pipeline import ingest
  with tempfile.TemporaryDirectory() as d:
   first=ingest(ROOT/'data/catalog',Path(d)/'lake');second=ingest(ROOT/'data/catalog',Path(d)/'lake')
   self.assertGreater(first['rows'],1000);self.assertTrue(second['cached'])
 def test_mirror_validates_hashes_before_manifest_switch(self):
  from .catalog_sync import sync
  with tempfile.TemporaryDirectory() as d:
   target=Path(d)/'catalog';bundled=ROOT/'data/catalog';manifest=json.loads((bundled/'manifest.json').read_text());manifest['snapshot_id']='fixture-snapshot'
   calls=[]
   def read(url,limit):
    calls.append(url)
    if url.endswith('manifest.json'):return json.dumps(manifest).encode()
    return (ROOT/url.split('/main/')[1]).read_bytes()
   with patch('backend.catalog_sync.read_url',side_effect=read):self.assertEqual(sync(target,bundled)['status'],'updated')
   saved=(target/'manifest.json').read_bytes();manifest['snapshot_id']='corrupt-fixture';manifest['groups'][0]['sha256']='incorrect'
   with patch('backend.catalog_sync.read_url',side_effect=read):
    with self.assertRaises(ValueError):sync(target,bundled)
   self.assertEqual((target/'manifest.json').read_bytes(),saved)
 def test_historical_validation_requires_truth(self):
  import pandas as pd
  from .hindcast import evaluate
  with tempfile.TemporaryDirectory() as d:
   obs=Path(d)/'obs.csv';pred=Path(d)/'pred.csv';keys={'date_utc':['2020','2021','2022'],'group':['fixture']*3,'minimum_fragment_size_m':[.1]*3}
   pd.DataFrame(keys|{'observed_count':[10,20,30],'source_url':['https://example.org/synthetic-test']*3,'coverage_notes':['Synthetic unit-test fixture']*3}).to_csv(obs,index=False)
   pd.DataFrame(keys|{'predicted_count':[12,18,30]}).to_csv(pred,index=False)
   self.assertAlmostEqual(evaluate(obs,pred)['mae'],4/3)
   pd.read_csv(obs).iloc[:0].to_csv(obs,index=False)
   with self.assertRaises(ValueError):evaluate(obs,pred)
if __name__=='__main__':unittest.main()
