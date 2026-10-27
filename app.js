import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EARTH_RADIUS_KM, SIDEREAL_DAY_S, TAU, SITES, circularOrbit, orbitPosition, surfacePosition, canLaunch, launchPlane, displayRadius, missionParametersValid, validateSavedMission } from './orbits.js';

const $ = id => document.getElementById(id);
const storageKey = 'orbit-lab-missions-v1';
const MAX_SATELLITES = 30;
const colors = [0xb8f6d4, 0x78b8ff, 0xffbc7a, 0xc4b3ff, 0xffa8bb];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let scene, renderer, camera, controls, earth, clouds, earthGroup, markerGroup, preview;
let simulationTime = 0, paused = reducedMotion, lastTime = 0, flight = null, selectedId = null;
let satellites = [], ready = false, colorIndex = 0, frameId;
const sunDirection = new THREE.Vector3(3.5, 1.8, 4).normalize();
let orbitMaterial, rocketGeometry, satelliteGeometry;

function message(text) { $('mission-status').textContent = text; }
function earthAngle() { return (simulationTime % SIDEREAL_DAY_S) * TAU / SIDEREAL_DAY_S; }
function vector(values) { return new THREE.Vector3(...values); }
function currentRadius(altitude) { return displayRadius(altitude, $('spread').checked); }
function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({version: 1, simulationTime,
      satellites: satellites.map(({id, name, altitude, inclination, raan, phase, epoch, color}) => ({id, name, altitude, inclination, raan, phase, epoch, color}))}));
  } catch { message('Browser storage is unavailable. Export missions to keep your work.'); }
}
function snapshot() {
  return { version: 1, simulationTime, satellites: satellites.map(({name, altitude, inclination, raan, phase, epoch, color}) => ({name, altitude, inclination, raan, phase, epoch, color})) };
}
function validSnapshot(data) {
  return data && data.version === 1 && Number.isFinite(data.simulationTime) && data.simulationTime >= 0
    && data.simulationTime < 1e12 && Array.isArray(data.satellites) && data.satellites.length <= MAX_SATELLITES
    && data.satellites.every(validateSavedMission);
}

async function init() {
  try {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, .01, 300);
    camera.position.set(2.4, 1.25, 4.2);
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setClearColor(0x080d15, 0);
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', 'Photographic 3D Earth with fictional satellites in circular orbits. Use the camera buttons for alternate views.');
    $('scene').appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !reducedMotion;
    controls.enablePan = false;
    controls.minDistance = 1.32;
    controls.maxDistance = 60;
    controls.rotateSpeed = .65;
    controls.zoomSpeed = .8;
    controls.target.set(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xc3d7ff, 1.5));
    const light = new THREE.DirectionalLight(0xfff1dd, 3);
    light.position.copy(sunDirection).multiplyScalar(10); scene.add(light);
    makeStars();
    earthGroup = new THREE.Group(); scene.add(earthGroup);
    markerGroup = new THREE.Group(); earthGroup.add(markerGroup);
    const loader = new THREE.TextureLoader();
    const [day, night, cloud] = await Promise.all([
      loader.loadAsync('./assets/textures/earth-day.jpg'),
      loader.loadAsync('./assets/textures/earth-night.jpg'),
      loader.loadAsync('./assets/textures/earth-packed.jpg'),
    ]);
    day.colorSpace = THREE.SRGBColorSpace; night.colorSpace = THREE.SRGBColorSpace;
    day.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const earthMaterial = new THREE.ShaderMaterial({
      uniforms: {dayMap: {value: day}, nightMap: {value: night}, sun: {value: sunDirection}},
      vertexShader: `varying vec2 vUv; varying vec3 vWorldNormal;
        void main(){vUv=uv; vWorldNormal=normalize(mat3(modelMatrix)*normal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform sampler2D dayMap; uniform sampler2D nightMap; uniform vec3 sun;
        varying vec2 vUv; varying vec3 vWorldNormal;
        void main(){float light=dot(normalize(vWorldNormal),sun);
        float daylight=smoothstep(-0.10,0.22,light);
        vec3 land=texture2D(dayMap,vUv).rgb;
        vec3 lights=texture2D(nightMap,vUv).rgb;
        vec3 color=land*(0.055+0.95*max(light,0.0))+lights*(1.0-daylight)*1.5;
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    });
    earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), earthMaterial); earthGroup.add(earth);
    const cloudMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {packed: {value: cloud}, sun: {value: sunDirection}},
      vertexShader: `varying vec2 vUv; varying vec3 vWorldNormal;
        void main(){vUv=uv;vWorldNormal=normalize(mat3(modelMatrix)*normal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform sampler2D packed;uniform vec3 sun; varying vec2 vUv;varying vec3 vWorldNormal;
        void main(){float opacity=smoothstep(0.2,1.0,texture2D(packed,vUv).b)*0.85;
        float light=0.04+max(0.0,dot(normalize(vWorldNormal),sun));
        gl_FragColor=vec4(vec3(light),opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    });
    clouds = new THREE.Mesh(new THREE.SphereGeometry(1.006, 80, 48), cloudMaterial); earthGroup.add(clouds);
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.035, 80, 48), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      uniforms: {sun: {value: sunDirection}},
      vertexShader: `varying vec3 vNormal; varying vec3 vEye; varying vec3 vWorldNormal;
        void main(){vec4 p=modelViewMatrix*vec4(position,1.0); vEye=-p.xyz; vNormal=normalize(normalMatrix*normal);
        vWorldNormal=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*p;}`,
      fragmentShader: `uniform vec3 sun; varying vec3 vNormal; varying vec3 vEye; varying vec3 vWorldNormal;
        void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vEye))),3.0);
        float daylight=smoothstep(-0.4,0.6,dot(normalize(vWorldNormal),sun));
        gl_FragColor=vec4(vec3(0.18,0.48,0.95),rim*(0.18+0.65*daylight));}`,
    })); scene.add(atmosphere);
    makeSiteMarkers();
    satelliteGeometry = new THREE.BoxGeometry(.027, .027, .027);
    rocketGeometry = new THREE.ConeGeometry(.012, .075, 10);
    orbitMaterial = new THREE.LineBasicMaterial({color: 0xb8f6d4, transparent: true, opacity: .8});
    loadFleet();
    if (paused) updatePause();
    resize(); new ResizeObserver(resize).observe($('scene'));
    document.addEventListener('visibilitychange', () => {lastTime = 0; if (document.hidden) save();});
    addEventListener('pagehide', save);
    ready = true; $('loading').hidden = true; updateForm(); updateFleet();
    frameId = requestAnimationFrame(animate);
    document.documentElement.dataset.ready = 'true';
  } catch (error) {
    console.error(error);
    $('loading').textContent = 'Earth could not load. Try a browser with WebGL enabled, then reload.';
    $('launch').disabled = true; $('place').disabled = true;
  }
}
function makeStars() {
  let seed = 314159;
  const random = () => {seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296;};
  const positions = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i++) {
    const a = random() * TAU, z = 2 * random() - 1, r = 80 + random() * 20;
    positions.set([r * Math.sqrt(1 - z * z) * Math.cos(a), r * z, r * Math.sqrt(1 - z * z) * Math.sin(a)], i * 3);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({color: 0xacc2da, size: .085, transparent: true, opacity: .45, depthWrite: false})));
}
function makeSiteMarkers() {
  for (const site of Object.values(SITES)) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.009, 10, 8), new THREE.MeshBasicMaterial({color: 0xffbc7a}));
    dot.position.copy(vector(surfacePosition(site.lat, site.lon)).multiplyScalar(1.009)); markerGroup.add(dot);
  }
}
function makeOrbitLine(mission, opacity = .34, dashed = false) {
  const points = Array.from({length: 257}, (_, n) => vector(orbitPosition(currentRadius(mission.altitude), mission.inclination, mission.raan, n / 256 * TAU)));
  const material = dashed ? new THREE.LineDashedMaterial({color: mission.color, transparent: true, opacity, dashSize: .035, gapSize: .025})
    : new THREE.LineBasicMaterial({color: mission.color, transparent: true, opacity});
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
  if (dashed) line.computeLineDistances();
  line.userData.initialRaan = mission.raan;
  line.visible = $('show-orbits').checked;
  return line;
}
function satelliteModel(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(satelliteGeometry, new THREE.MeshStandardMaterial({color: 0xeeeeee, metalness: .65, roughness: .4})); group.add(body);
  const panelMaterial = new THREE.MeshStandardMaterial({color: 0x284571, emissive: color, emissiveIntensity: .12, metalness: .4, roughness: .45});
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(.048, .004, .033), panelMaterial);
    panel.position.x = side * .042; group.add(panel);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.009, 8, 6), new THREE.MeshBasicMaterial({color}));
  beacon.position.y = .02; group.add(beacon); return group;
}
function addSatellite(parameters, persist = true) {
  if (satellites.length >= MAX_SATELLITES) {message('This browser sandbox supports up to 30 satellites. Remove one to add another.'); return null;}
  const mission = {...parameters, id: crypto.randomUUID(), color: Number.isInteger(parameters.color) && parameters.color >= 0 && parameters.color <= 0xffffff ? parameters.color : colors[colorIndex++ % colors.length]};
  mission.mesh = satelliteModel(mission.color); scene.add(mission.mesh);
  mission.line = makeOrbitLine(mission); scene.add(mission.line);
  satellites.push(mission); updateFleet();
  if (persist) save();
  return mission;
}
function disposeObject(object) {
  object.traverse(node => {if (node.geometry && node.geometry !== satelliteGeometry && node.geometry !== rocketGeometry) node.geometry.dispose(); if (node.material) node.material.dispose();});
  scene.remove(object);
}
function removeSatellite(id) {
  const mission = satellites.find(s => s.id === id); if (!mission) return;
  disposeObject(mission.mesh); disposeObject(mission.line); satellites = satellites.filter(s => s.id !== id);
  if (selectedId === id) selectedId = null;
  updateFleet(); save(); updateForm();
}
function loadFleet() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw);
      if (validSnapshot(saved)) {simulationTime = saved.simulationTime; saved.satellites.forEach(s => addSatellite(s, false)); return;}
    }
  } catch { /* A browser with storage disabled can still run the sandbox. */ }
  addSatellite({name: 'Horizon · demo', altitude: 550, inclination: 51.6, raan: .25, phase: .8, epoch: 0}, false);
  addSatellite({name: 'Polar · demo', altitude: 800, inclination: 97.4, raan: 1.15, phase: 2.7, epoch: 0}, false);
}
function updateFleet() {
  const list = $('satellite-list'); list.replaceChildren();
  satellites.forEach(mission => {
    const li = document.createElement('li'); li.className = 'satellite-row';
    const focus = document.createElement('button'); focus.type = 'button'; focus.className = 'sat-focus';
    focus.setAttribute('aria-label', `View ${mission.name}, altitude ${mission.altitude} kilometers`);
    const symbol = document.createElement('span'); symbol.className = 'sat-symbol'; symbol.textContent = '◇'; symbol.style.setProperty('--sat-color', `#${mission.color.toString(16).padStart(6, '0')}`); symbol.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.className = 'sat-description';
    const name = document.createElement('strong'); name.textContent = mission.name;
    const meta = document.createElement('small'); meta.textContent = `${mission.altitude.toLocaleString()} km · ${mission.inclination}° · ${(circularOrbit(mission.altitude).periodS / 60).toFixed(1)} min`;
    text.append(name, meta); focus.append(symbol, text); focus.addEventListener('click', () => focusMission(mission));
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'sat-remove'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove ${mission.name}`);
    remove.addEventListener('click', () => removeSatellite(mission.id)); li.append(focus, remove); list.append(li);
  });
  if (!satellites.length) {const li = document.createElement('li'); li.className = 'empty-fleet'; li.textContent = 'An open sky. Add your first satellite.'; list.append(li);}
  $('fleet-count').textContent = String(satellites.length).padStart(2, '0');
  $('scene-count').textContent = `${satellites.length} satellite${satellites.length === 1 ? '' : 's'} in your sandbox`;
}
function focusMission(mission) {
  selectedId = mission.id;
  const r = currentRadius(mission.altitude);
  const direction = mission.mesh.position.length() > .1 ? mission.mesh.position.clone().normalize() : new THREE.Vector3(1, .4, 1).normalize();
  camera.position.copy(direction.multiplyScalar(Math.max(3.1, r * 3)));
  camera.position.y += .35; controls.target.set(0, 0, 0); controls.update();
  satellites.forEach(s => s.line.material.opacity = s.id === selectedId ? .75 : .22);
  message(`${mission.name}: ${(circularOrbit(mission.altitude).periodS / 60).toFixed(1)} minutes per orbit at ${mission.altitude.toLocaleString()} km.`);
}
function formParameters() {
  return {name: $('satellite-name').value.trim(), altitude: Number($('altitude').value), inclination: Number($('inclination').value)};
}
function updateForm() {
  const params = formParameters();
  const valid = missionParametersValid(params) && $('altitude').value !== '' && $('inclination').value !== '';
  const site = SITES[$('launch-site').value];
  if (valid) {
    const orbit = circularOrbit(params.altitude);
    $('period').innerHTML = `${(orbit.periodS / 60).toFixed(1)} <small>min</small>`;
    $('velocity').innerHTML = `${orbit.speedKmS.toFixed(2)} <small>km/s</small>`;
  } else {$('period').textContent = '—'; $('velocity').textContent = '—';}
  const reachable = valid && canLaunch(site.lat, params.inclination);
  $('launch-hint').textContent = reachable ? `Direct launch from ${site.name} into this plane.` : `Direct launch needs ${site.lat}°–${180 - site.lat}° inclination here. You can still place a satellite directly.`;
  $('launch-hint').classList.toggle('warning', !reachable);
  $('launch').disabled = !ready || !reachable || Boolean(flight) || satellites.length >= MAX_SATELLITES;
  $('place').disabled = !ready || !valid || Boolean(flight) || satellites.length >= MAX_SATELLITES;
  updatePreview();
}
function updatePreview() {
  if (!scene || !ready || flight) return;
  if (preview) {disposeObject(preview); preview = null;}
  const params = formParameters(); if (!missionParametersValid(params)) return;
  const site = SITES[$('launch-site').value];
  const plane = canLaunch(site.lat, params.inclination) ? launchPlane(site, params.inclination, earthAngle()) : {raan: 0};
  preview = makeOrbitLine({...params, ...plane, color: 0xffbc7a}, .4, true); scene.add(preview);
}
function nextName() { $('satellite-name').value = `Explorer ${String(satellites.length + 1).padStart(2, '0')}`; }
function placeSatellite() {
  if ($('place').disabled || !$('mission-form').reportValidity()) return;
  const params = formParameters();
  const site = SITES[$('launch-site').value];
  const plane = canLaunch(site.lat, params.inclination) ? launchPlane(site, params.inclination, earthAngle()) : {raan: 0, phase: 0};
  const mission = addSatellite({...params, ...plane, epoch: simulationTime});
  if (mission) {message(`${mission.name} placed in a ${params.altitude.toLocaleString()} km circular orbit.`); nextName(); if (params.altitude > 4000) wideView();}
  updateForm();
}
function startLaunch(event) {
  event.preventDefault();
  if ($('launch').disabled) return;
  const params = formParameters(), site = SITES[$('launch-site').value];
  const plane = launchPlane(site, params.inclination, earthAngle());
  if (preview) {disposeObject(preview); preview = null;}
  const rocket = new THREE.Group();
  const body = new THREE.Mesh(rocketGeometry, new THREE.MeshStandardMaterial({color: 0xf2f5f6, metalness: .35, roughness: .35})); rocket.add(body);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(.012, .07, 10), new THREE.MeshBasicMaterial({color: 0xffbc7a, transparent: true, opacity: .9}));
  plume.rotation.z = Math.PI; plume.position.y = -.06; rocket.add(plume); scene.add(rocket);
  const trail = new THREE.Line(new THREE.BufferGeometry(), orbitMaterial.clone()); scene.add(trail);
  const planned = makeOrbitLine({...params, ...plane, color: 0xffbc7a}, .55, true); scene.add(planned);
  flight = {...params, ...plane, rocket, trail, planned, progress: 0, points: [], site};
  $('flight-hud').hidden = false; $('flight-progress').value = 0; $('flight-percent').textContent = '0%';
  $('flight-stage').textContent = 'LIFTOFF';
  const direction = vector(surfacePosition(site.lat, site.lon, earthAngle()));
  camera.position.copy(direction.multiplyScalar(Math.max(3.6, currentRadius(params.altitude) * 2.6))); controls.target.set(0, 0, 0); controls.update();
  if (paused) {paused = false; updatePause();}
  message(`Launching ${params.name} from ${site.name}.`); updateForm();
}
function flightPosition(progress) {
  const eased = progress * progress * (3 - 2 * progress);
  const radius = 1.008 + (currentRadius(flight.altitude) - 1.008) * Math.sin(progress * Math.PI / 2);
  return vector(orbitPosition(radius, flight.inclination, flight.raan, flight.phase + .95 * eased));
}
function advanceFlight(dt) {
  if (!flight) return;
  flight.progress = Math.min(1, flight.progress + dt / (reducedMotion ? .2 : 9));
  const p = flight.progress, position = flightPosition(p);
  const next = flightPosition(Math.min(1, p + .002));
  const direction = next.sub(position); if (direction.lengthSq() > 1e-10) flight.rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  flight.rocket.position.copy(position);
  flight.points.push(position.clone()); flight.trail.geometry.dispose(); flight.trail.geometry = new THREE.BufferGeometry().setFromPoints(flight.points);
  $('flight-progress').value = p; $('flight-percent').textContent = `${Math.round(p * 100)}%`;
  $('flight-stage').textContent = p < .3 ? 'LIFTOFF' : p < .8 ? 'CLIMB & TURN' : 'SATELLITE DEPLOYMENT';
  if (p === 1) {
    const {name, altitude, inclination, raan, phase} = flight;
    disposeObject(flight.rocket); disposeObject(flight.trail); disposeObject(flight.planned); flight = null;
    addSatellite({name, altitude, inclination, raan, phase: phase + .95, epoch: simulationTime});
    $('flight-hud').hidden = true; message(`${name} deployed. One orbit every ${(circularOrbit(altitude).periodS / 60).toFixed(1)} minutes.`);
    nextName(); updateForm();
  }
}
function resize() {
  if (!renderer) return;
  const {width, height} = $('scene').getBoundingClientRect();
  renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
}
function animate(time) {
  const dt = lastTime ? Math.min((time - lastTime) / 1000, .1) : 0; lastTime = time;
  if (!paused && !document.hidden) {
    simulationTime += dt * Number($('speed').value);
    advanceFlight(dt);
  }
  earthGroup.rotation.y = earthAngle();
  for (const mission of satellites) {
    const phase = mission.phase + (simulationTime - mission.epoch) * TAU / circularOrbit(mission.altitude).periodS;
    mission.mesh.position.set(...orbitPosition(currentRadius(mission.altitude), mission.inclination, mission.raan, phase));
    mission.mesh.rotation.y = phase;
    // Fixed enlarged models remain readable at higher camera distances.
    mission.mesh.scale.setScalar(Math.min(8, Math.max(1, camera.position.length() / 5)));
  }
  if (preview && !paused) {
    // The candidate plane follows the rotating launch site; deployed orbits stay inertial.
    const params = formParameters(), site = SITES[$('launch-site').value];
    if (missionParametersValid(params) && canLaunch(site.lat, params.inclination)) {
      const node = launchPlane(site, params.inclination, earthAngle()).raan;
      preview.rotation.y = node - (preview.userData.initialRaan ??= node);
    }
  }
  const total = Math.floor(simulationTime), hours = Math.floor(total / 3600), minutes = Math.floor(total / 60) % 60, seconds = total % 60;
  $('elapsed').textContent = `T+ ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  controls.update(); renderer.render(scene, camera); frameId = requestAnimationFrame(animate);
}
function updatePause() {
  $('pause').textContent = paused ? '▶' : 'Ⅱ'; $('pause').setAttribute('aria-label', paused ? 'Resume simulation' : 'Pause simulation'); $('pause').setAttribute('aria-pressed', String(paused));
}
function wideView() {
  const maxRadius = Math.max(1.4, ...satellites.map(s => currentRadius(s.altitude)), currentRadius(Number($('altitude').value) || 550));
  camera.position.set(.7, .4, 1).normalize().multiplyScalar(Math.min(58, maxRadius * 3.6)); controls.target.set(0, 0, 0); controls.update();
}
function rebuildOrbits() {
  for (const mission of satellites) {disposeObject(mission.line); mission.line = makeOrbitLine(mission); scene.add(mission.line);}
  updatePreview(); if (flight) {disposeObject(flight.planned); flight.planned = makeOrbitLine({...flight, color: 0xffbc7a}, .55, true); scene.add(flight.planned);}
}
$('mission-form').addEventListener('submit', startLaunch);
$('place').addEventListener('click', placeSatellite);
$('pause').addEventListener('click', () => {paused = !paused; updatePause(); save();});
$('preset').addEventListener('change', () => {
  const presets = {leo: [550, 51.6], polar: [800, 97.4], geo: [35786, 0]};
  const values = presets[$('preset').value]; if (values) {[$('altitude').value, $('inclination').value] = values;}
  updateForm(); if (values && values[0] > 4000 && ready) wideView();
});
for (const id of ['altitude', 'inclination']) $(id).addEventListener('input', () => {$('preset').value = 'custom'; updateForm();});
$('satellite-name').addEventListener('input', updateForm);
$('launch-site').addEventListener('change', updateForm);
$('show-orbits').addEventListener('change', () => {satellites.forEach(s => s.line.visible = $('show-orbits').checked); if (preview) preview.visible = $('show-orbits').checked; if (flight) flight.planned.visible = $('show-orbits').checked;});
$('show-clouds').addEventListener('change', () => {if (clouds) clouds.visible = $('show-clouds').checked;});
$('show-sites').addEventListener('change', () => {if (markerGroup) markerGroup.visible = $('show-sites').checked;});
$('spread').addEventListener('change', () => {if (ready) {rebuildOrbits(); wideView();}});
$('view-home').addEventListener('click', () => {if (!ready) return;camera.position.set(2.4, 1.25, 4.2); controls.target.set(0, 0, 0); controls.update();});
$('view-top').addEventListener('click', () => {if (!ready) return;const distance = Math.max(3.5, camera.position.length());camera.position.set(.001, distance, .001); controls.target.set(0, 0, 0); controls.update();});
$('view-wide').addEventListener('click', () => {if (ready) wideView();});
$('clear').addEventListener('click', () => {
  if (flight) {message('Wait until the current launch finishes before clearing the fleet.'); return;}
  satellites.slice().forEach(s => removeSatellite(s.id)); message('Sky cleared. Plan your next orbit.');
});
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(snapshot(), null, 2)], {type: 'application/json'}), url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'orbit-lab-missions.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  message('Mission configuration exported as JSON.');
});
$('import').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (flight) throw new Error('Wait until the current launch finishes before importing.');
    if (file.size > 100000) throw new Error('Use a mission file smaller than 100 KB.');
    const data = JSON.parse(await file.text()); if (!validSnapshot(data)) throw new Error('Invalid mission file. Use an Orbit Lab export with up to 30 valid satellites.');
    satellites.slice().forEach(s => removeSatellite(s.id)); simulationTime = data.simulationTime;
    data.satellites.forEach(s => addSatellite(s, false)); save(); updateForm(); wideView(); message(`Imported ${data.satellites.length} satellite missions.`);
  } catch (error) {message(error.message);}
  event.target.value = '';
});
$('about-open').addEventListener('click', () => $('about').showModal());
$('about-close').addEventListener('click', () => $('about').close());
$('about').addEventListener('click', event => {if (event.target === $('about')) {const r = $('about').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('about').close();}});
init();
