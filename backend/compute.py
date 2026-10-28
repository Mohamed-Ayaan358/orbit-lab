"""One compute operation across HTTP requests and the persistent worker."""
import threading
from contextlib import contextmanager
COMPUTE_LOCK=threading.Lock()
@contextmanager
def computation(blocking=False):
    acquired=COMPUTE_LOCK.acquire(blocking=blocking)
    if not acquired:raise RuntimeError('The server is busy with another experiment. Please retry shortly.')
    try:yield
    finally:COMPUTE_LOCK.release()
