// -----------------------------------------------------------------------------
// Device type: PORT.
//
// One Gladys device per port of a controller: the outlet a fan, a light, a
// humidifier or a heater is plugged into. Three features:
//   - power: on (1) / off (0). Reads whether the port runs now (`loadState`);
//     a command sets the port to the On or Off mode;
//   - speed: the level the port runs at, 0 to 10 (`speak`). A command sets the
//     On level and the On mode (0 sets the Off mode);
//   - mode: the AC Infinity mode of the port (Off, On, Auto, Timer, Cycle,
//     Schedule, VPD...), a select. Only the mode is changed: the Auto
//     thresholds, timers and schedules stay those set in the AC Infinity app.
//
// In a mode other than On and Off the controller decides the level itself: a
// speed set from Gladys switches the port to the On mode.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import { AT_TYPE, PORT_MODES, modeOfAtType, modeOfKey } from '../acinfinity/constants.js';
import { isAiController } from '../acinfinity/client.js';
import { isControllerOnline, portsOf } from '../acinfinity/hub.js';
import { cleanName, controllerName, isOn, numberOrNull, stateEntry } from './helpers.js';

export const PORT_FEATURES = { POWER: 'power', SPEED: 'speed', MODE: 'mode' };

export const MIN_SPEED = 0;
export const MAX_SPEED = 10;

/** The modes a port of this controller offers (the sensor modes are AI only). */
export function modesOf(controllerResource) {
  const ai = isAiController(controllerResource);
  return PORT_MODES.filter((mode) => ai || !mode.ai);
}

/** The display name of a port, e.g. "Grow tent - Exhaust fan". */
export function portName(controllerResource, portResource) {
  return `${controllerName(controllerResource)} - ${cleanName(
    portResource?.portName,
    `Port ${portResource?.port}`,
  )}`;
}

/** A level the API accepts: an integer between 0 and 10. */
export function clampSpeed(value) {
  const number = numberOrNull(value);
  if (number === null) {
    throw new Error(`Invalid speed: ${value}`);
  }
  return Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, number)));
}

/** The API changes that set a port to the On mode at a level. */
export function speedChanges(controllerResource, level) {
  const speed = clampSpeed(level);
  if (speed === 0) {
    return { atType: AT_TYPE.OFF };
  }
  return {
    atType: AT_TYPE.ON,
    [isAiController(controllerResource) ? 'onSelfSpead' : 'onSpead']: speed,
  };
}

export const port = {
  kind: 'port',

  /** Every port of every controller of the snapshot. */
  entries(hub) {
    return hub.snapshot.controllers.flatMap((controllerResource) =>
      portsOf(controllerResource).map((resource) => ({
        id: `${controllerResource.devId}-${resource.port}`,
        resource,
        controller: controllerResource,
      })),
    );
  },

  build(gladys, { id, resource, controller: controllerResource }) {
    const ids = gladys.externalIds(this.kind, id);
    return {
      name: portName(controllerResource, resource),
      external_id: ids.device,
      features: [
        {
          name: 'Power',
          external_id: ids.feature(PORT_FEATURES.POWER),
          category: DEVICE_FEATURE_CATEGORIES.SWITCH,
          type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
          read_only: false,
          has_feedback: true,
          keep_history: true,
          min: 0,
          max: 1,
        },
        {
          name: 'Speed',
          external_id: ids.feature(PORT_FEATURES.SPEED),
          category: DEVICE_FEATURE_CATEGORIES.FAN,
          type: DEVICE_FEATURE_TYPES.FAN.SPEED,
          read_only: false,
          has_feedback: true,
          keep_history: true,
          min: MIN_SPEED,
          max: MAX_SPEED,
        },
        {
          name: 'Mode',
          external_id: ids.feature(PORT_FEATURES.MODE),
          category: DEVICE_FEATURE_CATEGORIES.TEXT,
          type: DEVICE_FEATURE_TYPES.TEXT.SELECT,
          read_only: false,
          has_feedback: true,
          keep_history: false,
          min: 0,
          max: 0,
          supported_options: modesOf(controllerResource).map((mode, index) => ({
            value: mode.key,
            label: mode.label,
            sort_order: index,
          })),
        },
      ],
    };
  },

  states(gladys, { id, resource }) {
    const ids = gladys.externalIds(this.kind, id);
    const mode = modeOfAtType(resource.curMode);
    const loadState = numberOrNull(resource.loadState);
    return [
      ...(loadState === null
        ? []
        : [
            {
              device_feature_external_id: ids.feature(PORT_FEATURES.POWER),
              state: loadState > 0 ? 1 : 0,
            },
          ]),
      ...stateEntry(ids.feature(PORT_FEATURES.SPEED), resource.speak),
      ...(mode
        ? [{ device_feature_external_id: ids.feature(PORT_FEATURES.MODE), text: mode.key }]
        : []),
    ];
  },

  /** The API changes a Gladys command means; null for a read-only feature. */
  command(featureKey, value, { controller: controllerResource }) {
    if (featureKey === PORT_FEATURES.POWER) {
      return { atType: isOn(value) ? AT_TYPE.ON : AT_TYPE.OFF };
    }
    if (featureKey === PORT_FEATURES.SPEED) {
      return speedChanges(controllerResource, value);
    }
    if (featureKey === PORT_FEATURES.MODE) {
      const mode = modeOfKey(String(value));
      if (!mode || !modesOf(controllerResource).includes(mode)) {
        throw new Error(`Unknown AC Infinity mode: ${value}`);
      }
      return { atType: mode.atType };
    }
    return null;
  },

  /** A port is reachable when its controller is online and the port reports. */
  isReachable({ resource, controller: controllerResource }) {
    return isControllerOnline(controllerResource) && Number(resource.online) !== 0;
  },
};
