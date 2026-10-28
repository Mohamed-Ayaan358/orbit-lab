"""Run from repository root: python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000"""
from pathlib import Path
import os,json,time,secrets
from contextlib import asynccontextmanager
from collections import defaultdict,deque
from fastapi import Request,Depends
from .jobs import JobQueue
from .compute import computation
from datetime import datetime,timezone
from typing import Literal
from fastapi import FastAPI,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel,Field,model_validator
from .engine import run_scenario
ROOT=Path(__file__).resolve().parents[1]
from .schemas import Scenario
@asynccontextmanager
async def lifespan(app):
    state=Path(os.environ.get('ORBIT_STATE_DIR',str(ROOT/'.state')))
    from .catalog_sync import sync
    idle_task=(lambda:sync(state/'catalog',ROOT/'data/catalog')) if os.environ.get('ORBIT_CATALOG_SYNC')=='1' else None
    app.state.jobs=JobQueue(state,idle_task=idle_task)
    app.state.jobs.start()
    yield
    app.state.jobs.close()
app=FastAPI(title='Orbit Lab population scenarios',version='3.0.0',lifespan=lifespan)
request_times=defaultdict(deque)
public_times=deque()
import threading
RATE_LOCK=threading.Lock()
def authorize_public():
    now=time.monotonic()
    with RATE_LOCK:
        while public_times and public_times[0]<now-60:public_times.popleft()
        if len(public_times)>=6:raise HTTPException(status_code=429,detail='Shared preview limit: six experiments per minute. Browser preview remains available.')
        public_times.append(now)
def compute_call(function,*args):
    try:
        with computation():return function(*args)
    except RuntimeError as error:raise HTTPException(status_code=429,detail=str(error)) from error
def authorize_compute(request:Request):
    expected=os.environ.get('ORBIT_API_TOKEN','')
    if expected and not secrets.compare_digest(request.headers.get('authorization',''),'Bearer '+expected):raise HTTPException(status_code=401,detail='A valid backend access token is required.')
    key=request.client.host if request.client else 'unknown';now=time.monotonic();queue=request_times[key]
    while queue and queue[0]<now-60:queue.popleft()
    if len(queue)>=10:raise HTTPException(status_code=429,detail='Compute limit: 10 requests per minute per client.')
    queue.append(now)

allowed=os.environ.get('ORBIT_ALLOWED_ORIGINS','http://127.0.0.1:8080,http://localhost:8080,https://mohamed-ayaan358.github.io').split(',')
app.add_middleware(CORSMiddleware,allow_origins=allowed,allow_methods=['GET','POST'],allow_headers=['Content-Type','Authorization'])
def check_host_limits(config):
    max_runs=int(os.environ.get('ORBIT_MAX_RUNS','20000'));max_cells=int(os.environ.get('ORBIT_MAX_RUN_YEARS','1000000'))
    if config.runs>max_runs or config.runs*config.years>max_cells:raise HTTPException(status_code=422,detail=f'This lightweight server allows {max_runs} runs and {max_cells} run-years per arm. Use offline batch/Spark jobs for larger experiments.')
@app.get('/api/health')
def health():return {'status':'ok','engine':'NumPy','version':'3.0.0','async_jobs':True,'token_required':bool(os.environ.get('ORBIT_API_TOKEN')),'model':'uncalibrated population teaching model','max_runs':int(os.environ.get('ORBIT_MAX_RUNS','20000')),'max_run_years':int(os.environ.get('ORBIT_MAX_RUN_YEARS','1000000'))}
@app.post('/api/simulate',dependencies=[Depends(authorize_compute)])
def simulate(config:Scenario):
    check_host_limits(config)
    start=time.perf_counter()
    try: result=compute_call(run_scenario,config.model_dump())
    except (ValueError,OverflowError) as e:raise HTTPException(status_code=422,detail=str(e)) from e
    result['elapsed_ms']=round((time.perf_counter()-start)*1000,2)
    return result
@app.post('/api/preview',dependencies=[Depends(authorize_public)])
def preview(config:Scenario):
    if config.runs>500 or config.years>30:raise HTTPException(status_code=422,detail='Public preview supports at most 500 runs over 30 years. Use browser preview or an access token for larger jobs.')
    return simulate(config)
@app.post('/api/jobs',status_code=202,dependencies=[Depends(authorize_compute)])
def create_job(config:Scenario,request:Request):
    check_host_limits(config)
    try:return request.app.state.jobs.submit(config.model_dump())
    except ValueError as error:raise HTTPException(status_code=429,detail=str(error))
@app.get('/api/jobs/{identifier}')
def get_job(identifier:str,request:Request):
    expected=os.environ.get('ORBIT_API_TOKEN','')
    if expected and not secrets.compare_digest(request.headers.get('authorization',''),'Bearer '+expected):raise HTTPException(status_code=401,detail='A valid backend access token is required.')
    job=request.app.state.jobs.get(identifier,include_result=True)
    if job is None:raise HTTPException(status_code=404,detail='Unknown job')
    return job
class EncounterInput(BaseModel):
    miss_x_m:float=Field(default=100,ge=-100000,le=100000)
    miss_y_m:float=Field(default=0,ge=-100000,le=100000)
    cov_xx_m2:float=Field(default=10000,gt=0,le=1e12)
    cov_xy_m2:float=Field(default=0,ge=-1e12,le=1e12)
    cov_yy_m2:float=Field(default=10000,gt=0,le=1e12)
    radius_m:float=Field(default=10,gt=0,le=1000)
@app.post('/api/encounter-probability',dependencies=[Depends(authorize_compute)])
def encounter_probability(value:EncounterInput):
    from .conjunction import disk_probability
    try:return compute_call(lambda:disk_probability(**value.model_dump()))
    except ValueError as error:raise HTTPException(status_code=422,detail=str(error))
@app.post('/api/preview/encounter-probability',dependencies=[Depends(authorize_public)])
def preview_probability(value:EncounterInput):return encounter_probability(value)
class ScreeningInput(BaseModel):
    altitude:float=Field(default=550,ge=160,le=2000)
    inclination:float=Field(default=51.6,ge=0,le=180)
    raan:float=Field(default=.4,ge=-7,le=7)
    phase:float=Field(default=.6,ge=-1e6,le=1e6)
    reference_utc:datetime
    @model_validator(mode="after")
    def utc_time(self):
        if self.reference_utc.tzinfo is None:raise ValueError("Provide a timezone-aware UTC reference date.")
        self.reference_utc=self.reference_utc.astimezone(timezone.utc)
        return self
    epoch_seconds:float=Field(default=0,ge=0,le=604800)
    hours:int=Field(default=2,ge=1,le=6)
    step_s:int=Field(default=120,ge=60,le=600)
    limit:int=Field(default=500,ge=20,le=1000)
    group:Literal['all','debris']='debris'
@app.post('/api/screen',dependencies=[Depends(authorize_compute)])
def screening(value:ScreeningInput):
    from .screening import screen
    try:return compute_call(screen,ROOT/'data/catalog',value.model_dump(mode='json'))
    except (ValueError,KeyError) as error:raise HTTPException(status_code=422,detail=str(error))
@app.post('/api/preview/screen',dependencies=[Depends(authorize_public)])
def preview_screen(value:ScreeningInput):
    if value.limit>200 or value.hours>2:raise HTTPException(status_code=422,detail='Public screening supports 200 objects over two hours.')
    return screening(value)
@app.get('/api/science/status')
def science_status():
    path=ROOT/'data/science/status.json'
    return json.loads(path.read_text()) if path.exists() else {'status':'science verification pending'}
@app.get('/api/catalog')
def catalog():
    from .screening import catalog_root
    return json.loads((catalog_root(ROOT/'data/catalog')/'manifest.json').read_text())
# Explicit public files only: never expose backend source, Git metadata, or local files.
class FrontendFiles(StaticFiles):
    async def get_response(self,path,scope):
        path='index.html' if path in {'','.'} else path
        clean=Path(path)
        public_dirs={'assets','vendor','downloads','data','validation'}
        public_files={'index.html','app.js','lab.js','science.js','orbits.js','random.js','risk.js','help.js','population-model.js','catalog-worker.js','simulation-worker.js','orbital-physics.js','fragment-worker.js','styles.css','CREDITS.md'}
        if any(part.startswith('.') for part in clean.parts) or (str(clean) not in public_files and (not clean.parts or clean.parts[0] not in public_dirs)):raise HTTPException(status_code=404)
        return await super().get_response(path,scope)
app.mount('/',FrontendFiles(directory=ROOT,html=True),name='frontend')
