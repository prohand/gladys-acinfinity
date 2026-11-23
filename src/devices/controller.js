// -----------------------------------------------------------------------------
// Device type: CONTROLLER.
//
// One Gladys device per UIS controller (69 Pro, 69 Pro+, AI+, Outlet AI...):
// the readings of its built-in probe — temperature, humidity and VPD (vapor
// pressure deficit, the grower's measure of how much the air "pulls" water
// from the leaves). Read-only. Its ports are devices of their own (port.js).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { CONTROLLER_MODELS } from '../acinfinity/constants.js';
import { isControllerOnline } from '../acinfinity/hub.js';
import { controllerReadings } from '../acinfinity/readings.js';
import { controllerName, stateEntry } from './helpers.js';

export const CONTROLLER_FEATURES = {
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  VPD: 'vpd',
};

/** The model name of a controller, from its `devType`. */
export function controllerModel(controller) {
  return CONTROLLER_MODELS[Number(controller?.devType)] ?? `UIS Controller ${controller?.devType}`;
}

export const controller = {
  kind: 'controller',

  /** Every controller of the snapshot, with its device id. */
  entries(hub) {
    return hub.snapshot.controllers.map((resource) => ({
      id: String(resource.devId),
      resource,
      controller: resource,
    }));
  },

  build(gladys, { id, resource }) {
    const ids = gladys.externalIds(this.kind, id);
    return {
      name: controllerName(resource),
      external_id: ids.device,
      features: [
        {
          name: 'Temperature',
          external_id: ids.feature(CONTROLLER_FEATURES.TEMPERATURE),
          category: DEVICE_FEATURE_CATEGORIES.TEMPERATURE_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.CELSIUS,
          read_only: true,
          has_feedback: false,
          keep_history: true,
          min: -20,
          max: 60,
        },
        {
          name: 'Humidity',
          external_id: ids.feature(CONTROLLER_FEATURES.HUMIDITY),
          category: DEVICE_FEATURE_CATEGORIES.HUMIDITY_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.PERCENT,
          read_only: true,
          has_feedback: false,
          keep_history: true,
          min: 0,
          max: 100,
        },
        {
          name: 'VPD',
          external_id: ids.feature(CONTROLLER_FEATURES.VPD),
          category: DEVICE_FEATURE_CATEGORIES.PRESSURE_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.KILO_PASCAL,
          read_only: true,
          has_feedback: false,
          keep_history: true,
          min: 0,
          max: 10,
        },
      ],
    };
  },

  states(gladys, { id, resource }) {
    const ids = gladys.externalIds(this.kind, id);
    const readings = controllerReadings(resource);
    return [
      ...stateEntry(ids.feature(CONTROLLER_FEATURES.TEMPERATURE), readings.temperature),
      ...stateEntry(ids.feature(CONTROLLER_FEATURES.HUMIDITY), readings.humidity),
      ...stateEntry(ids.feature(CONTROLLER_FEATURES.VPD), readings.vpd),
    ];
  },

  /** The readings are read-only. */
  command() {
    return null;
  },

  isReachable({ resource }) {
    return isControllerOnline(resource);
  },
};
