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

Launch paths are kinematic animations, not dynamically integrated rocket trajectories. No satellite catalog, debris catalog, weather feed or collision model is used by this website.
