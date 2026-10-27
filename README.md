# Orbit Lab

A static, interactive 3D Earth and satellite sandbox. Built with JavaScript and Three.js. Designed to run on GitHub Pages without a backend or build step.

## What you can do

- Explore a photographic Earth with clouds, atmosphere and day/night lighting.
- Set satellite altitude and inclination; see circular-orbit speed and period.
- Animate a launch from Cape Canaveral, Kourou, Vandenberg or Sriharikota into a geometrically reachable plane.
- Place satellites directly, including at geostationary altitude.
- Pause time, change playback speed, rotate the view and show all orbits.
- Remove satellites, keep missions in browser storage, and import/export JSON.
- Download the companion Python statistics lab.

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

The included `.github/workflows/pages.yml` checks the orbital calculations and deploys the static files on every push to `main`.

1. Upload this folder as the root of a GitHub repository.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. Push to `main` or run **Publish Orbit Lab** from the Actions tab.

All links and asset paths are relative, so the site works at a GitHub project URL such as `https://USERNAME.github.io/orbit-lab/`.

## How realistic is it?

Earth is photographic. Satellite motion is a circular, two-body model with a spherical Earth. Earth rotation and orbital motion share the accelerated simulation clock. Orbits are inertial; geographic markers rotate with Earth. Satellite models and markers are enlarged for visibility. An optional setting increases displayed altitude spacing without changing physical speed or period.

Rocket ascent is an illustrative animation into an orbit plane, not a rocket performance calculation. There is no fuel, thrust, staging, eccentricity, atmospheric drag, precession, solar perturbation or collision prediction. The near-polar preset is not a modeled sun-synchronous orbit. No live objects or launch predictions are shown. The fleet is capped at 30 satellites for this browser demo.

The geostationary-altitude preset can be placed directly. A direct equatorial launch from the listed non-equatorial spaceports is disabled; transfer maneuvers are outside the model. Exported missions contain orbital settings and simulation time, not operational flight instructions.

## Data science and big data

`downloads/Space_Object_Data_Science_Lab.zip` contains the earlier executed Python notebook, synthetic scenarios, model source and lessons on Poisson distributions, Normal sample means, summaries and PyMC inference. Those synthetic population scenarios are separate from the circular-orbit visualizer.

This browser sandbox is not itself a big data system. A course project could use it as the visual frontend for scenario ensembles generated across workers, stored in partitioned Parquet, and summarized with Spark. That pipeline and a scientifically validated debris model would be additional work.

See [CREDITS.md](CREDITS.md) for assets, reference values and limitations.
