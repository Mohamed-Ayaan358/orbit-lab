# Credits and reference values

## Rendering and assets

- [Three.js](https://threejs.org/), version 0.180.0, MIT license. The vendored source and license are in `vendor/three/`.
- Earth day, night and cloud maps: **[Solar System Scope / INOVE](https://www.solarsystemscope.com/textures/)**, [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). They are supplied in resized/packed form by the [Three.js r180 planet texture collection](https://github.com/mrdoob/three.js/tree/r180/examples/textures/planets), upstream files `earth_day_4096.jpg`, `earth_night_4096.jpg`, and `earth_bump_roughness_clouds_4096.jpg`. This project renames the files and samples the packed blue channel for clouds. These are adjusted photographic maps based on NASA imagery, not current imagery or live weather.
- Generated stars, satellite models, rocket shapes, interface and orbital calculations are part of this project.

All runtime assets are hosted with the site. There are no CDN dependencies, API keys, analytics, or authentication requirements for visitors.

## Model

Circular two-body orbits use `v = sqrt(mu / r)` and `T = 2*pi*sqrt(r^3 / mu)`.

- Spherical Earth radius: 6,378.137 km (equatorial reference radius).
- Earth gravitational parameter: 398,600.4418 km³/s².
- Earth sidereal rotation period: 86,164.0905 seconds.
- [NASA Earth facts](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html).
- [NASA: orbital mechanics](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-1/).

Launch-site coordinates are rounded geographic reference points, not exact pad coordinates. Plane reachability uses the launch latitude; it omits operational azimuth restrictions, downrange safety, propulsion, plane-change capability and launch windows. A geostationary-altitude, zero-inclination orbit placed directly in this model approximately matches Earth rotation. Direct launches from the offered non-equatorial sites to that plane require maneuvers omitted by this sandbox and are disabled.

Launch paths are kinematic animations, not dynamically integrated rocket trajectories. The catalog layer uses the timestamped selected CelesTrak groups described below. The separate population simulator uses an assumed homogeneous-mixing collision coefficient; it is not a geometric collision predictor. There is no live weather feed.

## Catalog data and propagation

- Orbital elements: [CelesTrak](https://celestrak.org/NORAD/elements/), selected public groups retrieved 2026-10-27. Each source URL and epoch range is in `data/catalog/manifest.json`.
- SGP4 propagation: [satellite.js](https://github.com/shashwatak/satellite-js), version 6.0.1, MIT license, vendored under `vendor/satellite/`.
- Public groups provide a partial catalog. Object counts are not complete debris counts; orbital elements are not a physical breakup model.
- Synthetic population ensemble and fragment-count examples: this project's teaching model. Hypothetical ASAT aftermath is an aggregate breakup event only, with no intercept or weapon dynamics. The selected distribution's mean is an assumption.

## Additional science sources

- [MOCAT-pySSEM](https://github.com/ARCLab-MIT/pyssem), MIT license. Cached synthetic reference output only; not an operational forecast.
- [NASA Spaceflight Safety Handbook](https://www.nasa.gov/wp-content/uploads/2020/03/spaceflight_safety_handbook_for_operators_v1.5_aug201.pdf): encounter-plane probability assumptions.
- [CelesTrak usage policy](https://celestrak.org/usage-policy.php): cached, bounded snapshot refresh.
- [python-sgp4](https://github.com/brandon-rhodes/python-sgp4), MIT license, backend mean-element propagation.
