FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend backend
COPY index.html app.js orbits.js lab.js random.js risk.js help.js population-model.js catalog-worker.js simulation-worker.js styles.css CREDITS.md ./
COPY assets assets
COPY vendor vendor
COPY data data
COPY downloads downloads
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
