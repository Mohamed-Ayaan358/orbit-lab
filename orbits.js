// Circular two-body orbits, with y as north and east longitude toward -z.
export const EARTH_RADIUS_KM = 6378.137;
export const EARTH_MU = 398600.4418; // km³/s²
export const SIDEREAL_DAY_S = 86164.0905;
export const TAU = 2 * Math.PI;
const rad = degrees => degrees * Math.PI / 180;
export const SITES = Object.freeze({
  cape: { name: 'Cape Canaveral', lat: 28.5, lon: -80.6 },
  kourou: { name: 'Kourou', lat: 5.2, lon: -52.8 },
  vandenberg: { name: 'Vandenberg', lat: 34.7, lon: -120.6 },
  sriharikota: { name: 'Sriharikota', lat: 13.7, lon: 80.2 },
});
export function circularOrbit(altitudeKm) {
  const radiusKm = EARTH_RADIUS_KM + altitudeKm;
  return {
    radiusKm,
    speedKmS: Math.sqrt(EARTH_MU / radiusKm),
    periodS: TAU * Math.sqrt(radiusKm ** 3 / EARTH_MU),
  };
}
export function orbitPosition(radius, inclinationDeg, raanRad, phaseRad) {
  const i = rad(inclinationDeg), c = Math.cos(phaseRad), s = Math.sin(phaseRad);
  return [
    radius * (Math.cos(raanRad) * c - Math.sin(raanRad) * s * Math.cos(i)),
    radius * s * Math.sin(i),
    -radius * (Math.sin(raanRad) * c + Math.cos(raanRad) * s * Math.cos(i)),
  ];
}
export function surfacePosition(latDeg, lonDeg, earthAngle = 0) {
  const lat = rad(latDeg), lon = rad(lonDeg) + earthAngle;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)];
}
export function canLaunch(latitude, inclination) {
  return inclination >= Math.abs(latitude) && inclination <= 180 - Math.abs(latitude);
}
// Select the northbound intersection of a plane through the launch site.
// This is a geometric plane constraint, not launch vehicle performance.
export function launchPlane(site, inclination, earthAngle = 0) {
  if (!canLaunch(site.lat, inclination)) throw new RangeError('Inclination is not directly reachable from this latitude.');
  const i = rad(inclination), lat = rad(site.lat);
  const phase = Math.asin(Math.max(-1, Math.min(1, Math.sin(lat) / Math.sin(i))));
  const longitudeInPlane = Math.atan2(Math.sin(phase) * Math.cos(i), Math.cos(phase));
  return { phase, raan: rad(site.lon) + earthAngle - longitudeInPlane };
}
export function displayRadius(altitudeKm, spread = false) {
  return 1 + altitudeKm / EARTH_RADIUS_KM * (spread ? 6 : 1);
}
export function missionParametersValid(mission) {
  return typeof mission.name === 'string' && mission.name.trim().length > 0 && mission.name.length <= 32
    && Number.isFinite(mission.altitude) && mission.altitude >= 160 && mission.altitude <= 50000
    && Number.isFinite(mission.inclination) && mission.inclination >= 0 && mission.inclination <= 180;
}
export function validateSavedMission(mission) {
  return mission && missionParametersValid(mission) && Number.isFinite(mission.raan)
    && Number.isFinite(mission.phase) && Number.isFinite(mission.epoch)
    && Math.abs(mission.raan) < 1e9 && Math.abs(mission.phase) < 1e9 && Math.abs(mission.epoch) < 1e12;
}
