// -----------------------------------------------------------------------------
// Device type: PLUG-IN SENSOR (AI controllers).
//
// The AI controllers (AI+, Outlet AI...) take extra sensors on their USB-C
// sensor ports: temperature/humidity probe, CO2 + light sensor, soil sensor,
// water sensor, hydro sensor. One Gladys device per sensor port, with one
// feature per reading. Read-only.
//
// EC and TDS readings (hydro sensor) have no Gladys unit yet: they are not
// published.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { SENSOR_TYPES } from '../acinfinity/constants.js';
import { isControllerOnline } from '../acinfinity/hub.js';
import { sensorGroups, sensorValue } from '../acinfinity/readings.js';
import { controllerName, stateEntry } from './helpers.js';

const C = DEVICE_FEATURE_CATEGORIES;
const T = DEVICE_FEATURE_TYPES;
const U = DEVICE_FEATURE_UNITS;

/**
 * The Gladys feature of each sensor type, by stable key (part of the feature
 * external id: never rename one). A °F and a °C entry of the same probe share
 * the key: one feature, in °C.
 */
export const SENSOR_FEATURES = {
  [SENSOR_TYPES.PROBE_TEMPERATURE_C]: {
    key: 'temperature',
    name: 'Temperature',
    category: C.TEMPERATURE_SENSOR,
    type: T.SENSOR.DECIMAL,
    unit: U.CELSIUS,
    min: -20,
    max: 60,
  },
  [SENSOR_TYPES.PROBE_HUMIDITY]: {
    key: 'humidity',
    name: 'Humidity',
    category: C.HUMIDITY_SENSOR,
    type: T.SENSOR.DECIMAL,
    unit: U.PERCENT,
    min: 0,
    max: 100,
  },
  [SENSOR_TYPES.PROBE_VPD]: {
    key: 'vpd',
    name: 'VPD',
    category: C.PRESSURE_SENSOR,
    type: T.SENSOR.DECIMAL,
    unit: U.KILO_PASCAL,
    min: 0,
    max: 10,
  },
  [SENSOR_TYPES.SOIL]: {
    key: 'soil_moisture',
    name: 'Soil moisture',
    category: C.SOIL_MOISTURE_SENSOR,
    type: T.SENSOR.DECIMAL,
    unit: U.PERCENT,
    min: 0,
    max: 100,
  },
  [SENSOR_TYPES.CO2]: {
    key: 'co2',
    name: 'CO2',
    category: C.CO2_SENSOR,
    type: T.SENSOR.DECIMAL,
    unit: U.PPM,
    min: 0,
    max: 10000,
  },
  [SENSOR_TYPES.LIGHT]: {
    key: 'light',
    name: 'Light',
    category: C.LIGHT_SENSOR,
    type: T.SENSOR.DECIMAL,
    unit: U.PERCENT,
    min: 0,
    max: 100,
  },
  [SENSOR_TYPES.HYDRO_PH]: {
    key: 'ph',
    name: 'pH',
    category: C.PH_SENSOR,
    type: T.PH_SENSOR.DECIMAL,
    unit: U.PH,
    min: 0,
    max: 14,
  },
  [SENSOR_TYPES.HYDRO_WATER_TEMPERATURE_C]: {
    key: 'water_temperature',
    name: 'Water temperature',
    category: C.TEMPERATURE_SENSOR,
    // A probe in the water: Gladys keeps it out of the room average.
    type: T.TEMPERATURE_SENSOR.PROBE,
    unit: U.CELSIUS,
    min: 0,
    max: 50,
  },
  [SENSOR_TYPES.WATER]: {
    key: 'water_detected',
    name: 'Water detected',
    category: C.LEAK_SENSOR,
    type: T.SENSOR.BINARY,
    min: 0,
    max: 1,
  },
};
SENSOR_FEATURES[SENSOR_TYPES.PROBE_TEMPERATURE_F] =
  SENSOR_FEATURES[SENSOR_TYPES.PROBE_TEMPERATURE_C];
SENSOR_FEATURES[SENSOR_TYPES.HYDRO_WATER_TEMPERATURE_F] =
  SENSOR_FEATURES[SENSOR_TYPES.HYDRO_WATER_TEMPERATURE_C];

// The °C entry wins over the °F one of the same probe.
const PREFERRED = new Set([
  SENSOR_TYPES.PROBE_TEMPERATURE_C,
  SENSOR_TYPES.HYDRO_WATER_TEMPERATURE_C,
]);

/** The model of a sensor port, from the readings it gives. */
export function sensorModel(sensors) {
  const types = new Set(sensors.map((s) => Number(s.sensorType)));
  const has = (...list) => list.some((type) => types.has(type));
  if (has(SENSOR_TYPES.CO2, SENSOR_TYPES.LIGHT)) {
    return 'CO2 + light sensor';
  }
  if (has(SENSOR_TYPES.SOIL)) {
    return 'Soil sensor';
  }
  if (has(SENSOR_TYPES.WATER)) {
    return 'Water sensor';
  }
  if (
    has(
      SENSOR_TYPES.HYDRO_PH,
      SENSOR_TYPES.HYDRO_EC_US,
      SENSOR_TYPES.HYDRO_EC_MS,
      SENSOR_TYPES.HYDRO_TDS_PPM,
      SENSOR_TYPES.HYDRO_TDS_PPT,
      SENSOR_TYPES.HYDRO_WATER_TEMPERATURE_C,
      SENSOR_TYPES.HYDRO_WATER_TEMPERATURE_F,
    )
  ) {
    return 'Hydro sensor';
  }
  return 'Sensor probe';
}

/**
 * The readings of a sensor port, one per feature key:
 * `[{ feature, value }]`, in the order of the API.
 */
export function sensorReadings(sensors) {
  const byKey = new Map();
  for (const sensor of sensors) {
    const type = Number(sensor.sensorType);
    const feature = SENSOR_FEATURES[type];
    if (!feature || (byKey.has(feature.key) && !PREFERRED.has(type))) {
      continue;
    }
    const value = sensorValue(sensor);
    byKey.set(feature.key, {
      feature,
      value: feature.type === T.SENSOR.BINARY && value !== null ? (value > 0 ? 1 : 0) : value,
    });
  }
  return [...byKey.values()];
}

export const sensor = {
  kind: 'sensor',

  /** Every sensor port (with at least one known reading) of every AI controller. */
  entries(hub) {
    return hub.snapshot.controllers.flatMap((controllerResource) =>
      sensorGroups(controllerResource)
        .filter(({ sensors }) => sensorReadings(sensors).length > 0)
        .map(({ accessPort, sensors }) => ({
          id: `${controllerResource.devId}-${accessPort}`,
          resource: { accessPort, sensors },
          controller: controllerResource,
        })),
    );
  },

  build(gladys, { id, resource, controller: controllerResource }) {
    const ids = gladys.externalIds(this.kind, id);
    return {
      name: `${controllerName(controllerResource)} - ${sensorModel(resource.sensors)}`,
      external_id: ids.device,
      features: sensorReadings(resource.sensors).map(({ feature }) => ({
        name: feature.name,
        external_id: ids.feature(feature.key),
        category: feature.category,
        type: feature.type,
        ...(feature.unit ? { unit: feature.unit } : {}),
        read_only: true,
        has_feedback: false,
        keep_history: true,
        min: feature.min,
        max: feature.max,
      })),
    };
  },

  states(gladys, { id, resource }) {
    const ids = gladys.externalIds(this.kind, id);
    return sensorReadings(resource.sensors).flatMap(({ feature, value }) =>
      stateEntry(ids.feature(feature.key), value),
    );
  },

  /** The readings are read-only. */
  command() {
    return null;
  },

  isReachable({ controller: controllerResource }) {
    return isControllerOnline(controllerResource);
  },
};
