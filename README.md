# Orbit Lab

An interactive 3D Earth, catalog viewer and statistical population sandbox. The public frontend runs on GitHub Pages without a build step; an optional Python backend computes larger ensembles.

**[Open Orbit Lab](https://mohamed-ayaan358.github.io/orbit-lab/)**

## What you can do

- Explore a photographic Earth with clouds, atmosphere and day/night lighting.
- Set satellite altitude and inclination; see circular-orbit speed and period.
- Animate a launch with vertical climb, pitch-over, stage separation, exhaust, payload deployment and a follow camera from four spaceports.
- Place satellites directly, including at geostationary altitude.
- Pause time, change playback speed, rotate the view and show all orbits.
- Remove satellites, keep missions in browser storage, and import/export JSON.
- Load all 19,495 objects in a timestamped CelesTrak snapshot of four selected groups, with SGP4 propagation and a drawing-limit slider.
- Choose among all 27 saved scenarios and download all 418,500 raw synthetic records.
- Scale initial populations 1×, 5×, 10× or 100×; change launches, disposal, collision assumptions, simulation horizon and run count.
- Choose Poisson, Negative Binomial or rounded Lognormal fragment-count models and explore four responsive graphs.
- Simulate an abstract ASAT aftermath as a generic population breakup event; no interceptor or target selection is modeled.
- Download the companion Python statistics lab, or connect the [local Python backend](backend/README.md).

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

The backend includes a tested local batch-to-Parquet runner and an optional Spark batch extension. A Spark cluster benchmark, production queue, and scientifically validated fragmentation/decay model are not included. The browser visualization alone is not a big data system.

See [backend/README.md](backend/README.md) to run the compute service and [data/README.md](data/README.md) for provenance and coverage. The website works with approximate browser sampling when no Python server is connected; the UI states which engine produced each result.

See [CREDITS.md](CREDITS.md) for assets, reference values and limitations.

## Readability and post-deployment analysis

Hover, focus with the keyboard, or tap the ⓘ controls to explain terms such as active catalog, catalog debris, SGP4, inclination and model coefficients. Catalog satellites are larger cyan diamonds; debris is smaller orange dots; your missions are enlarged colored models. **Population → Satellite marker size** adjusts visibility without changing the model.

Deploying or placing a custom satellite automatically runs the current scenario assumptions and updates the hypothetical debris-collision probability graph below the globe. The deployment message links to that graph. The probability is a population-based teaching proxy, not a conjunction assessment or an actual prediction for that orbit.

For abstract breakup aftermath, the additional comparison graph shows with-extra-breakup and no-extra-breakup futures. The summary separates initial fragments from differences in later collisions/fragments. The model can show feedback or decay; it does not guarantee runaway growth. See the backend documentation for the formula, counterfactual definition and limitations.
