import unittest
import numpy as np
from fastapi.testclient import TestClient
from .app import app,Scenario
from .engine import run_scenario,fragment_draw,collision_proxy
class SimulationTests(unittest.TestCase):
 def test_reproducible(self):
  cfg=Scenario(runs=40,years=4).model_dump()
  self.assertEqual(run_scenario(cfg),run_scenario(cfg))
 def test_source_sink_zero_collisions(self):
  cfg=Scenario(runs=30,years=3,initial_satellites=0,initial_debris=0,annual_launches=0,collision_coefficient=0).model_dump()
  self.assertEqual(run_scenario(cfg)['final']['mean'],0)
 def test_event_adds_fragments_without_weapon_model(self):
  cfg=Scenario(runs=1000,years=1,collision_coefficient=0,event_type='abstract_asat',event_year=1,fragment_mean=100).model_dump()
  out=run_scenario(cfg);self.assertAlmostEqual(out['event']['mean_new_debris'],100,delta=2)
  self.assertTrue(out['event']['applied'])
 def test_distribution_moments(self):
  for model in ['poisson','negative_binomial','lognormal']:
   x=fragment_draw(np.random.default_rng(1),model,60,100000)
   self.assertTrue(np.all(x>=0));self.assertAlmostEqual(x.mean(),60,delta=1)
   expected=60 if model=='poisson' else 780 if model=='negative_binomial' else 2304
   self.assertAlmostEqual(x.var(),expected,delta=expected*.07)
 def test_proxy_formula_and_deployment(self):
  h=np.full((6,2),2000.)
  r=collision_proxy(h,.5,2)
  self.assertEqual(r['trajectory'][2]['mean'],0)
  self.assertAlmostEqual(r['trajectory'][5]['mean'],1-np.exp(-.003))
  self.assertTrue(all(row['mean']==0 for row in collision_proxy(h,0)['trajectory']))
 def test_comparison_replays_baseline_and_no_false_secondary_collisions(self):
  cfg=Scenario(runs=100,years=6,event_year=2,collision_coefficient=0).model_dump()
  base=run_scenario(cfg);out=run_scenario(cfg|{'event_type':'abstract_asat'})
  self.assertEqual(out['counterfactual']['trajectory'],base['trajectory'])
  self.assertEqual(out['counterfactual']['secondary_collisions_delta'],0)
  self.assertAlmostEqual(out['counterfactual']['secondary_fragments_delta'],0)
 def test_unavailable_breakup_has_no_spurious_feedback(self):
  cfg=Scenario(runs=100,years=10,event_year=2,initial_satellites=0,annual_launches=0).model_dump()
  base=run_scenario(cfg);event=run_scenario(cfg|{'event_type':'abstract_asat'})
  self.assertEqual(event['event']['mean_new_debris'],0)
  self.assertEqual(event['trajectory'],base['trajectory'])
  self.assertEqual(event['counterfactual']['mean_final_delta'],0)
 def test_api_validation_and_hidden_paths(self):
  c=TestClient(app)
  self.assertEqual(c.get('/api/health').status_code,200)
  self.assertEqual(c.post('/api/simulate',json={'runs':20,'years':2}).status_code,200)
  for bad in [{'runs':999999},{'distribution':'weapon'},{'event_type':'abstract_asat','event_year':50,'years':3}]:self.assertEqual(c.post('/api/simulate',json=bad).status_code,422)
  self.assertEqual(c.get('/.git/config').status_code,404)
  self.assertEqual(c.get('/backend/app.py').status_code,404)
if __name__=='__main__':unittest.main()
