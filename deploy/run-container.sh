#!/bin/sh
set -eu
if [ ! -x /state/venv/bin/python ]; then python -m venv /state/venv; fi
if ! cmp -s /app/backend/requirements-runtime.txt /state/requirements-installed.txt; then
  /state/venv/bin/python -m pip install --only-binary=:all: -r /app/backend/requirements-runtime.txt
  cp /app/backend/requirements-runtime.txt /state/requirements-installed.txt
fi
exec /state/venv/bin/python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers --forwarded-allow-ips '*'
