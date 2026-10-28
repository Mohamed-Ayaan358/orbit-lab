"""Bounded persistent job queue for one API process. SQLite state survives restarts."""
import datetime as dt,json,sqlite3,threading,time,uuid
from pathlib import Path
from .engine import run_scenario
from .compute import computation
class JobQueue:
    def __init__(self,directory,max_pending=20,idle_task=None):
        self.directory=Path(directory);self.directory.mkdir(parents=True,exist_ok=True)
        self.idle_task=idle_task;self.last_idle_task=0
        self.path=self.directory/'jobs.sqlite';self.max_pending=max_pending;self.stop_event=threading.Event();self.thread=None
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,status TEXT NOT NULL,config TEXT NOT NULL,result TEXT,error TEXT,created TEXT NOT NULL,updated TEXT NOT NULL)')
            db.execute("UPDATE jobs SET status='queued' WHERE status='running'")
    def connect(self):
        db=sqlite3.connect(self.path,timeout=20);db.row_factory=sqlite3.Row;db.execute('PRAGMA journal_mode=WAL');return db
    def submit(self,config):
        now=dt.datetime.now(dt.timezone.utc).isoformat();identifier=uuid.uuid4().hex
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute("SELECT COUNT(*) FROM jobs WHERE status IN ('queued','running')").fetchone()[0]>=self.max_pending:raise ValueError('Job queue is full; retry after existing work completes.')
            db.execute("DELETE FROM jobs WHERE status IN ('completed','failed') AND id NOT IN (SELECT id FROM jobs WHERE status IN ('completed','failed') ORDER BY created DESC LIMIT 99)")
            db.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?,?)',(identifier,'queued',json.dumps(config),None,None,now,now))
        return self.get(identifier)
    def get(self,identifier,include_result=False):
        with self.connect() as db:row=db.execute('SELECT * FROM jobs WHERE id=?',(identifier,)).fetchone()
        if row is None:return None
        value={k:row[k] for k in ['id','status','error','created','updated']};value['config']=json.loads(row['config'])
        if include_result and row['result']:value['result']=json.loads(row['result'])
        return value
    def work_one(self):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE');row=db.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY created LIMIT 1").fetchone()
            if row is None:return False
            db.execute("UPDATE jobs SET status='running',updated=? WHERE id=?",(dt.datetime.now(dt.timezone.utc).isoformat(),row['id']))
        try:
            start=time.perf_counter()
            with computation(blocking=True):result=run_scenario(json.loads(row['config']))
            result['elapsed_ms']=round((time.perf_counter()-start)*1000,2)
            status,error,payload='completed',None,json.dumps(result,allow_nan=False)
        except Exception as exc:
            status,payload,error='failed',None,str(exc)
        with self.connect() as db:db.execute('UPDATE jobs SET status=?,result=?,error=?,updated=? WHERE id=?',(status,payload,error,dt.datetime.now(dt.timezone.utc).isoformat(),row['id']))
        return True
    def start(self):
        def loop():
            while not self.stop_event.is_set():
                if not self.work_one():
                    if self.idle_task and time.monotonic()-self.last_idle_task>21600:
                        self.last_idle_task=time.monotonic()
                        try:
                            with computation(blocking=True):self.idle_task()
                        except Exception as error:print('Catalog mirror preserved previous snapshot:',str(error),flush=True)
                    self.stop_event.wait(.25)
        self.thread=threading.Thread(target=loop,daemon=True,name='orbit-scenario-worker');self.thread.start()
    def close(self):
        self.stop_event.set()
        if self.thread:self.thread.join(timeout=10)
