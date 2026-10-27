"""Run from repository root: python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000"""
from pathlib import Path
import os,json,time
from typing import Literal
from fastapi import FastAPI,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel,Field,model_validator
from .engine import run_scenario
ROOT=Path(__file__).resolve().parents[1]
class Scenario(BaseModel):
    initial_satellites:int=Field(default=600,ge=0,le=10_000_000)
    initial_debris:int=Field(default=1400,ge=0,le=10_000_000)
    annual_launches:float=Field(default=120,ge=0,le=100_000)
    disposal:float=Field(default=.9,ge=0,le=1)
    collision_coefficient:float=Field(default=.4,ge=0,le=2)
    fragment_mean:float=Field(default=60,ge=1,le=10000)
    distribution:Literal['poisson','negative_binomial','lognormal']='poisson'
    dispersion:float=Field(default=5,ge=.5,le=1000)
    cv:float=Field(default=.8,ge=.1,le=2)
    years:int=Field(default=30,ge=1,le=100)
    runs:int=Field(default=500,ge=20,le=20000)
    seed:int=Field(default=20261027,ge=0,le=2**32-1)
    event_type:Literal['none','satellite_launch','abstract_asat']='none'
    event_year:int=Field(default=5,ge=1,le=100)
    @model_validator(mode='after')
    def bounded_work(self):
        if self.runs*self.years>1_000_000:raise ValueError('Use at most one million run-year transitions per request.')
        if self.event_type!='none' and self.event_year>self.years:raise ValueError('Event year must be within the simulated horizon.')
        return self
app=FastAPI(title='Orbit Lab population scenarios',version='2.0.0')
allowed=os.environ.get('ORBIT_ALLOWED_ORIGINS','http://127.0.0.1:8080,http://localhost:8080,https://mohamed-ayaan358.github.io').split(',')
app.add_middleware(CORSMiddleware,allow_origins=allowed,allow_methods=['GET','POST'],allow_headers=['Content-Type'])
@app.get('/api/health')
def health():return {'status':'ok','engine':'NumPy','model':'uncalibrated population teaching model','max_run_years':1000000}
@app.post('/api/simulate')
def simulate(config:Scenario):
    start=time.perf_counter()
    try: result=run_scenario(config.model_dump())
    except (ValueError,OverflowError) as e:raise HTTPException(status_code=422,detail=str(e)) from e
    result['elapsed_ms']=round((time.perf_counter()-start)*1000,2)
    return result
@app.get('/api/catalog')
def catalog():return json.loads((ROOT/'data/catalog/manifest.json').read_text())
# Explicit public files only: never expose backend source, Git metadata, or local files.
class FrontendFiles(StaticFiles):
    async def get_response(self,path,scope):
        clean=Path(path)
        if any(part.startswith('.') for part in clean.parts) or (clean.parts and clean.parts[0] in {'backend','scripts','tests','node_modules'}):raise HTTPException(status_code=404)
        return await super().get_response(path,scope)
app.mount('/',FrontendFiles(directory=ROOT,html=True),name='frontend')
