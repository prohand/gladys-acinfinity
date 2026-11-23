// -----------------------------------------------------------------------------
// Small helpers shared by the device blueprints.
// -----------------------------------------------------------------------------

/** A finite number, or null for a reading AC Infinity does not have. */
export function numberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Round to a number of decimals, keeping null. */
export function round(value, decimals = 2) {
  if (value === null) {
    return null;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** One numeric state entry, or nothing when the value is unknown. */
export function stateEntry(featureExternalId, value) {
  const state = numberOrNull(value);
  return state === null ? [] : [{ device_feature_external_id: featureExternalId, state }];
}

/** A display name, trimmed, with a fallback. */
export function cleanName(name, fallback) {
  return typeof name === 'string' && name.trim() ? name.trim() : fallback;
}

/** The display name of a controller. */
export function controllerName(controller) {
  return cleanName(controller?.devName, `AC Infinity ${controller?.devId}`);
}

/** Gladys sends 0/1 for a binary feature; be tolerant of booleans and strings. */
export function isOn(value) {
  return value === 1 || value === true || value === '1';
}
