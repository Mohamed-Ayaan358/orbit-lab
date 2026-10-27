import test from 'node:test';
import assert from 'node:assert/strict';
import { EARTH_RADIUS_KM, SIDEREAL_DAY_S, circularOrbit, orbitPosition, surfacePosition, canLaunch, launchPlane, displayRadius, validateSavedMission, SITES } from '../orbits.js';
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);
test('a 550 km circular orbit has plausible speed and period', () => {
  const orbit = circularOrbit(550);
  assert.ok(orbit.speedKmS > 7.5 && orbit.speedKmS < 7.7);
  assert.ok(orbit.periodS / 60 > 95 && orbit.periodS / 60 < 96);
});
test('geostationary-altitude equatorial orbit matches Earth rotation', () => {
  close(circularOrbit(35786).periodS, SIDEREAL_DAY_S, 2);
});
test('orbital positions preserve radius and inclination bounds', () => {
  for (const inclination of [0, 28.5, 51.6, 90, 97.4, 180]) {
    for (let phase = 0; phase < 6.28; phase += .1) {
      const position = orbitPosition(3, inclination, 1.2, phase);
      close(Math.hypot(...position), 3);
      assert.ok(Math.abs(position[1]) <= 3 * Math.abs(Math.sin(inclination * Math.PI / 180)) + 1e-9);
    }
  }
});
test('a direct-launch plane intersects its rotating launch site', () => {
  for (const site of Object.values(SITES)) {
    for (const inclination of [site.lat, 51.6, 90, 97.4, 180 - site.lat]) {
      for (const angle of [0, 1.1, 5.3]) {
        const plane = launchPlane(site, inclination, angle);
        const p = orbitPosition(1, inclination, plane.raan, plane.phase);
        const target = surfacePosition(site.lat, site.lon, angle);
        p.forEach((x, i) => close(x, target[i], 1e-7));
      }
    }
  }
});
test('unreachable launch planes are rejected, including retrograde bounds', () => {
  assert.equal(canLaunch(28.5, 0), false);
  assert.equal(canLaunch(28.5, 160), false);
  assert.equal(canLaunch(28.5, 97.4), true);
  assert.throws(() => launchPlane(SITES.cape, 0), RangeError);
});
test('visual spacing does not alter physical orbit calculations', () => {
  close(displayRadius(550, false), 1 + 550 / EARTH_RADIUS_KM);
  close(displayRadius(550, true), 1 + 3300 / EARTH_RADIUS_KM);
});
test('import validation rejects malformed or nonfinite mission data', () => {
  const valid = {name:'Test', altitude:550, inclination:51.6, raan:1, phase:0, epoch:0};
  assert.equal(validateSavedMission(valid), true);
  assert.equal(validateSavedMission({...valid, altitude:NaN}), false);
  assert.equal(validateSavedMission({...valid, inclination:181}), false);
  assert.equal(validateSavedMission({...valid, name:''}), false);
  assert.equal(validateSavedMission({...valid, raan:Infinity}), false);
});
