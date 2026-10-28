FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements-runtime.txt backend/requirements-runtime.txt
RUN pip install --no-cache-dir -r backend/requirements-runtime.txt
COPY backend backend
COPY index.html app.js orbits.js lab.js science.js orbital-physics.js fragment-worker.js random.js risk.js help.js population-model.js catalog-worker.js simulation-worker.js styles.css CREDITS.md ./
COPY assets assets
COPY vendor vendor
COPY data data
COPY downloads downloads
COPY validation validation
RUN useradd --create-home --uid 10001 orbit && mkdir /state && chown orbit:orbit /state
USER orbit
ENV ORBIT_STATE_DIR=/state
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
