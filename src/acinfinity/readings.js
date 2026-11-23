// -----------------------------------------------------------------------------
// Readings of the AC Infinity API, decoded to plain numbers.
//
// Two shapes coexist:
//   - classic controllers (69 Pro, 69 Pro+) give their built-in probe in
//     `deviceInfo`: `temperature` (°C × 100), `humidity` (% × 100) and
//     `vpdnums` (kPa × 100);
//   - AI controllers give a `sensors` array: one entry per reading, for the
//     controller itself and for each plug-in sensor (probe, CO2 + light,
//     soil, water, hydro), as `sensorData` with `sensorPrecision` digits
//     (precision 3 = hundredths) and a `sensorUnit` (0 = °F for temperatures).
// Temperatures are always returned in °C: Gladys converts for the user.
// -----------------------------------------------------------------------------

import { CONTROLLER_SENSOR_TYPES, SENSOR_TYPES } from './constants.js';
import { numberOrNull, round } from '../devices/helpers.js';
import { sensorsOf } from './hub.js';

const TEMPERATURE_TYPES = new Set([
  SENSOR_TYPES.PROBE_TEMPERATURE_F,
  SENSOR_TYPES.PROBE_TEMPERATURE_C,
  SENSOR_TYPES.CONTROLLER_TEMPERATURE_F,
  SENSOR_TYPES.CONTROLLER_TEMPERATURE_C,
  SENSOR_TYPES.HYDRO_WATER_TEMPERATURE_F,
  SENSOR_TYPES.HYDRO_WATER_TEMPERATURE_C,
]);

/** The value of one entry of the `sensors` array, °C for a temperature. */
export function sensorValue(sensor) {
  const data = numberOrNull(sensor?.sensorData);
  if (data === null) {
    return null;
  }
  const precision = numberOrNull(sensor.sensorPrecision) ?? 1;
  const value = precision > 1 ? data / 10 ** (precision - 1) : data;
  if (TEMPERATURE_TYPES.has(Number(sensor.sensorType)) && !(Number(sensor.sensorUnit) > 0)) {
    // Fahrenheit.
    return round(((value - 32) * 5) / 9, 2);
  }
  return round(value, 2);
}

/** The first entry of `sensors` among the given types (in order of preference). */
function findSensor(sensors, types) {
  for (const type of types) {
    const found = sensors.find((s) => Number(s.sensorType) === type);
    if (found) {
      return found;
    }
  }
  return null;
}

/** A `deviceInfo` value stored × 100. */
function hundredths(value) {
  const number = numberOrNull(value);
  return number === null ? null : round(number / 100, 2);
}

/**
 * The built-in readings of a controller: `{ temperature, humidity, vpd }`,
 * null for what it does not report.
 */
export function controllerReadings(controller) {
  const sensors = sensorsOf(controller).filter((s) =>
    CONTROLLER_SENSOR_TYPES.has(Number(s.sensorType)),
  );
  const info = controller?.deviceInfo ?? {};
  const fromSensor = (types) => {
    const sensor = findSensor(sensors, types);
    return sensor ? sensorValue(sensor) : null;
  };
  return {
    temperature:
      fromSensor([SENSOR_TYPES.CONTROLLER_TEMPERATURE_C, SENSOR_TYPES.CONTROLLER_TEMPERATURE_F]) ??
      hundredths(info.temperature),
    humidity: fromSensor([SENSOR_TYPES.CONTROLLER_HUMIDITY]) ?? hundredths(info.humidity),
    vpd: fromSensor([SENSOR_TYPES.CONTROLLER_VPD]) ?? hundredths(info.vpdnums),
  };
}

/**
 * The plug-in sensors of an AI controller, grouped by the port they are
 * plugged into: `[{ accessPort, sensors: [...] }]`, sorted by port.
 */
export function sensorGroups(controller) {
  const groups = new Map();
  for (const sensor of sensorsOf(controller)) {
    const type = Number(sensor?.sensorType);
    const accessPort = numberOrNull(sensor?.accessPort);
    if (CONTROLLER_SENSOR_TYPES.has(type) || accessPort === null) {
      continue;
    }
    if (!groups.has(accessPort)) {
      groups.set(accessPort, []);
    }
    groups.get(accessPort).push(sensor);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([accessPort, sensors]) => ({ accessPort, sensors }));
}
