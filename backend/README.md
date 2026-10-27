# Orbit Lab simulation backend

The frontend runs on GitHub Pages. GitHub Pages does not execute Python. This optional FastAPI service computes scenario ensembles with NumPy and SciPy and returns summaries for the website graphs.

## Start locally

From the repository root, using Python 3.12:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Or run `./backend/start.sh` to create the environment and start the service automatically.

Open **http://127.0.0.1:8000**. This serves the frontend and API together; the website connects automatically. This is the easiest local setup and avoids cross-origin browser restrictions.

API documentation: **http://127.0.0.1:8000/docs**.

Alternatively, on the GitHub site open **Models → Connect Python backend**, enter the base URL and connect. A public frontend needs an accessible backend with HTTPS; browsers may require permission for a local-network service. No hosted Python server has been provisioned by this project. Connecting is temporary and API credentials are not stored in browser storage.

## Example request

```sh
curl http://127.0.0.1:8000/api/simulate \
  -H 'Content-Type: application/json' \
  -d '{"runs":1000,"years":30,"distribution":"negative_binomial","fragment_mean":60,"dispersion":5,"event_type":"abstract_asat","event_year":5}'
```

The response includes the request configuration, random seed, population quantiles by year, final-year histogram, hypothetical fragment-count histogram, event count interval, and execution time. Same Python version, NumPy version, configuration and seed give reproducible draws. The browser uses a different generator and approximations; its samples are not bit-for-bit identical.

## What is being computed?

The model starts with chosen **population counts**, not a catalog of physically propagated fragments. Annual steps add Poisson launches, retire satellites with Binomial probability 0.08, add failed disposals, remove debris with Binomial probability 0.02, and propose Poisson satellite–debris collisions at `k * S * D / 1e6`, capped by available objects. Each collision removes one satellite and one debris object and adds a random fragment count.

An extra satellite event adds one satellite. An `abstract_asat` event removes one hypothetical satellite, if available, and adds a sampled fragment count. It calculates only a generic population consequence. There are no missile, target, intercept, warhead, impact-energy or operational weapon parameters.

Fragment count choices:

- **Poisson:** mean and variance both `fragment_mean`.
- **Negative Binomial:** mean `m`, variance `m + m² / dispersion` (Gamma–Poisson mixture).
- **Rounded Lognormal:** continuous mean `m`, variance `(m * cv)²`, then rounded to an integer. Rounding slightly changes the moments. Sums across multiple collisions are approximated by a moment-matched Lognormal; this is not an exact sum distribution.

None is a calibrated physical fragmentation model. The inputs do not specify object mass or fragment-size cutoff, so the output is not a real estimate of trackable debris from an actual event. The 3D burst is decorative and its particle velocities are not model outputs.

## Limits and larger jobs

An API request supports at most 20,000 runs, 100 years and one million run-year transitions. Initial counts are bounded at ten million per class. A run exceeding 100 million objects is stopped with an explicit error. Requests execute in a worker thread; this is a local prototype, not a distributed queue.

For larger experiments, `backend/batch.py` writes seeded batches of final-run outcomes to partitioned Parquet. `backend/spark_batch.py` distributes the same batches across Spark workers. Workers need the same Python dependencies and access to shared storage. These batch jobs intentionally do not pass large results through the website.

```sh
python -m backend.batch --runs 10000 --batch-size 1000 --output results/local
# Optional cluster setup: install PySpark and configure Java/shared object storage.
spark-submit --py-files backend.zip backend/spark_batch.py --runs 1000000 --output s3a://YOUR-BUCKET/orbit-results
```

Create `backend.zip` from the `backend/` package before submitting. Spark execution is a provided extension; a real cluster benchmark is not included or claimed.

## Hosting

A Dockerfile is included. Build from the repository root:

```sh
docker build -f backend/Dockerfile -t orbit-lab-api .
docker run --rm -p 8000:8000 orbit-lab-api
```

Deploy that image on a Python/container hosting service of your choice with an HTTPS endpoint. Set `ORBIT_ALLOWED_ORIGINS` to a comma-separated list of exact frontend origins. The default allows the project’s GitHub Pages origin and local development. CORS is not authentication. Before exposing the CPU-intensive API publicly, put authentication, rate limits, request limits and a job queue in front of it. This repository does not create a paid hosting account or a public compute endpoint.

Run checks with `python -m unittest backend.test_engine -v`.

## Deployment probability proxy and breakup feedback

Each response now includes `collision_proxy`: the chance of at least one collision for a hypothetical test satellite held in orbit under an independent Poisson exposure model. For each simulated population history, the annual hazard is `kappa * D_previous_year / 1e6`; cumulative probability is `1 - exp(-sum(hazard))`. The API reports the mean and 2.5/97.5% quantiles across population histories. A deployment event starts exposure after its insertion year. It does not count risk before deployment.

This is a **population teaching proxy**, not an actual collision probability for a catalog orbit. Satellite cross-section, orbital overlap, relative velocities, state covariance, maneuvers and retirement of the test object are omitted. All custom missions share the same assumed rate regardless of altitude/inclination. Marker size has no effect on probability. The 95% band reflects model population variability, not uncertainty about physical truth.

An abstract breakup run also computes a `counterfactual` arm with the same initial counts, parameters and seed but no extra breakup. It returns baseline population/risk curves, the final mean population difference, and differences in later collisions and fragments. The initial event's fragments are subtracted from the later-fragment difference. Debris does not reproduce; further collisions can create new fragments, while decay removes objects. No debris–debris collisions are modeled. Differences may be small or negative from dynamics and Monte Carlo noise; the interface does not force a worsening result. This comparison doubles the ensemble work for an abstract breakup request. It is a conditional model comparison, not an empirical causal estimate.
