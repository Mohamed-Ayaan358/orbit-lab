# Orbit Lab

An interactive 3D Earth, catalog viewer and statistical population sandbox. The public frontend runs on GitHub Pages without a build step; a lightweight hosted Python backend computes bounded ensembles.

**[Open Orbit Lab](https://mohamed-ayaan358.github.io/orbit-lab/)**

## What you can do

- Explore a photographic Earth with clouds, atmosphere and day/night lighting.
- Set satellite altitude and inclination; see circular-orbit speed and period.
- Animate a launch with vertical climb, pitch-over, stage separation, exhaust, payload deployment and a follow camera from four spaceports.
- Place satellites directly, including at geostationary altitude.
- Pause time, change playback speed, rotate the view and show all orbits.
- Remove satellites, keep missions in browser storage, and import/export JSON.
- Load all 19,497 objects in a timestamped CelesTrak snapshot of four selected groups, with SGP4 propagation and a drawing-limit slider.
- Choose among all 27 saved scenarios and download all 418,500 raw synthetic records.
- Scale initial populations 1×, 5×, 10× or 100×; change launches, disposal, collision assumptions, simulation horizon and run count.
- Choose Poisson, Negative Binomial or rounded Lognormal fragment-count models and explore responsive distribution, exposure and feedback graphs.
- Simulate an abstract ASAT aftermath as a generic population breakup event; no interceptor or target selection is modeled.
- Propagate a sample of fragments with two-body numerical integration and inspect the altitude envelope.
- Sample catalog near approaches and calculate a separate Gaussian encounter example from assumed inputs.
- Inspect an executed MOCAT-pySSEM synthetic reference and local Spark benchmark.
- Use the hosted Python preview, private persistent jobs, or the [local backend](backend/README.md).

## Tech stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | HTML, CSS, JavaScript modules | Interface, controls and tooltips |
| 3D rendering | Three.js | Earth, satellite models and launch animations |
| Browser computation | Web Workers | Orbit updates and simulations without blocking the interface |
| Charts | Custom SVG | Interactive graphs with keyboard and pointer inspection |
| Orbit propagation | satellite.js and Python SGP4 | Estimate object positions from saved orbital elements |
| Backend | Python, FastAPI, Uvicorn | Serve the simulation API and process bounded requests |
| Numerical computing | NumPy, SciPy | Population simulations and assumed encounter probabilities |
| Job storage | SQLite | Persist the single-worker calculation queue and results |
| Hosting | GitHub Pages; Docker on a VPS behind the existing Traefik proxy | Static website and separate Python service |
| Automation | GitHub Actions | Tests, site publication and scheduled catalog refresh |
| Local data engineering | pandas, PyArrow, Parquet | Validate, transform and store datasets |
| Local batch processing | PySpark | Run larger simulation batches and benchmark worker execution |
| Separate research model | MOCAT-pySSEM | Produce the cached synthetic reference experiment |

**Data source:** CelesTrak supplies orbital elements for selected satellite and debris groups. CelesTrak is a data provider; SGP4 is the algorithm used to estimate positions.

The heavier data engineering, Spark and pySSEM tools run locally, not on the VPS. The website displays their saved outputs. The hosted backend is configured for a 256 MiB memory limit and 0.25 CPU core; current use depends on the workload.

## Run locally

From this folder:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080`. Use a local server rather than double-clicking `index.html`, because JavaScript modules require HTTP. All textures and Three.js files are included; no API key or npm installation is needed to view the site.

To verify the model with Node 20 or later:

```sh
npm test
```

## Publish on GitHub Pages

The included `.github/workflows/pages.yml` runs JavaScript and Python tests and deploys the static frontend and data on every push to `main`. Backend source is kept in the repository and is not served by GitHub Pages.

1. Upload this folder as the root of a GitHub repository.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. Push to `main` or run **Publish Orbit Lab** from the Actions tab.

All links and asset paths are relative, so the site works at a GitHub project URL such as `https://USERNAME.github.io/orbit-lab/`.

## How realistic is it?

Earth is photographic. Satellite motion is a circular, two-body model with a spherical Earth. Earth rotation and orbital motion share the accelerated simulation clock. Orbits are inertial; geographic markers rotate with Earth. Satellite models and markers are enlarged for visibility. An optional setting increases displayed altitude spacing without changing physical speed or period.

Rocket ascent and stage separation are illustrative animations, not integrated rocket performance. Custom missions use circular two-body motion; the catalog layer separately uses SGP4 on actual orbital elements. There is no modeled rocket fuel, thrust or intercept physics. The near-polar mission preset is not a modeled sun-synchronous orbit. There is no live tracking feed or actual launch prediction. The custom fleet is capped at 30 detailed satellites; catalog dots are a separate layer supporting the complete selected snapshot.

The geostationary-altitude preset can be placed directly. A direct equatorial launch from the listed non-equatorial spaceports is disabled; transfer maneuvers are outside the model. Exported missions contain orbital settings and simulation time, not operational flight instructions.

## Data science and big data

`downloads/Space_Object_Data_Science_Lab.zip` contains the earlier executed Python notebook, synthetic scenarios, model source and lessons on Poisson distributions, Normal sample means, summaries and PyMC inference. Those synthetic population scenarios are separate from the circular-orbit visualizer.

The backend includes checksum-verified catalog-to-Parquet ingestion, a batch ensemble runner and an executed Spark path with local one/two-worker timing evidence. The hosted API uses a single-process persistent queue under a 256 MiB memory cap. Spark and pySSEM stay off the VPS. Multi-host performance and empirical fragmentation/decay calibration remain unverified. See [SCIENCE.md](SCIENCE.md) for evidence and reproducibility. The browser visualization alone is not a big data system.

See [backend/README.md](backend/README.md) to run the compute service and [data/README.md](data/README.md) for provenance and coverage. The website works with approximate browser sampling when no Python server is connected; the UI states which engine produced each result.

See [CREDITS.md](CREDITS.md) for assets, reference values and limitations.

## Readability and post-deployment analysis

Hover, focus with the keyboard, or tap the ⓘ controls to explain terms such as active catalog, catalog debris, SGP4, inclination and model coefficients. Catalog satellites are larger cyan diamonds; debris is smaller orange dots; your missions are enlarged colored models. **Objects → Satellite dot size** adjusts visibility without changing the model.

Deploying or placing a custom satellite automatically runs the current scenario assumptions and updates the hypothetical debris-collision probability graph below the globe. The deployment message links to that graph. The probability is a population-based teaching proxy, not a conjunction assessment or an actual prediction for that orbit.

For abstract breakup aftermath, the additional comparison graph shows with-extra-breakup and no-extra-breakup futures. The summary separates initial fragments from differences in later collisions/fragments. The model can show feedback or decay; it does not guarantee runaway growth. See the backend documentation for the formula, counterfactual definition and limitations.

## Plain-language guides

Graph titles ask a question, reading guides explain the axes and colors, and ⓘ controls define the main terms. Advanced distribution settings stay in an optional disclosure. Cleanup success is entered as a percentage; the model still receives a fraction. Breakup comparisons use a solid purple line and dashed orange baseline, with a separate difference graph under “See small differences & more numbers.” The summary describes the observed simulation difference without treating it as a measured causal effect.
