// -----------------------------------------------------------------------------
// Scene triggers (Gladys 5.1+, manifest `scene_triggers`).
//
// AC Infinity pushes nothing: the triggers are found by comparing two
// refreshes. The first refresh after a start only sets the reference, so a
// restart never replays "the lights turned on" for lights on since the morning.
//
// A change Gladys asked for is merged into the snapshot at once (see
// ACInfinityHub.setPort): the next refresh sees no difference and fires
// nothing, so a scene that turns a port on is never re-triggered by itself.
// -----------------------------------------------------------------------------

import { isControllerOnline } from '../acinfinity/hub.js';
import { controller } from '../devices/controller.js';
import { controllerName, numberOrNull } from '../devices/helpers.js';
import { port, portName } from '../devices/port.js';
import { sensor, sensorReadings } from '../devices/sensor.js';

export const TRIGGERS = {
  CONTROLLER_CONNECTIVITY_CHANGED: 'controller_connectivity_changed',
  PORT_POWER_CHANGED: 'port_power_changed',
  WATER_DETECTED_CHANGED: 'water_detected_changed',
};

export const CONNECTIVITY = { ONLINE: 'online', OFFLINE: 'offline' };
export const POWER = { ON: 'on', OFF: 'off' };
export const WATER = { DETECTED: 'detected', CLEARED: 'cleared' };

/** Every trigger key the integration fires (see test/manifest.test.js). */
export const SCENE_TRIGGER_KEYS = Object.values(TRIGGERS);

/** The entries of a blueprint in a snapshot, by id. */
function entriesById(blueprint, snapshot) {
  return new Map(blueprint.entries({ snapshot }).map((entry) => [entry.id, entry]));
}

/** `1` / `0` for a port running or not, null when unknown. */
function portPower(entry) {
  const loadState = numberOrNull(entry.resource.loadState);
  return loadState === null ? null : loadState > 0 ? 1 : 0;
}

/** `1` / `0` for water detected or not, null when the port has no water sensor. */
function waterDetected(entry) {
  return (
    sensorReadings(entry.resource.sensors).find(({ feature }) => feature.key === 'water_detected')
      ?.value ?? null
  );
}

/**
 * The scene events between two snapshots, as `{ key, data }`.
 * `data` only carries keys the manifest declares (fields + variables).
 */
export function detectSceneEvents(gladys, previous, next) {
  if (!previous) {
    return [];
  }
  const events = [];

  const controllersBefore = entriesById(controller, previous);
  for (const current of controller.entries({ snapshot: next })) {
    const before = controllersBefore.get(current.id);
    if (!before) {
      continue;
    }
    const was = isControllerOnline(before.resource);
    const now = isControllerOnline(current.resource);
    if (was !== now) {
      events.push({
        key: TRIGGERS.CONTROLLER_CONNECTIVITY_CHANGED,
        data: {
          device: gladys.externalIds(controller.kind, current.id).device,
          status: now ? CONNECTIVITY.ONLINE : CONNECTIVITY.OFFLINE,
          device_name: controllerName(current.resource),
        },
      });
    }
  }

  const portsBefore = entriesById(port, previous);
  for (const current of port.entries({ snapshot: next })) {
    const before = portsBefore.get(current.id);
    const was = before ? portPower(before) : null;
    const now = portPower(current);
    if (was !== null && now !== null && was !== now) {
      events.push({
        key: TRIGGERS.PORT_POWER_CHANGED,
        data: {
          device: gladys.externalIds(port.kind, current.id).device,
          state: now ? POWER.ON : POWER.OFF,
          device_name: portName(current.controller, current.resource),
          speed: numberOrNull(current.resource.speak) ?? 0,
        },
      });
    }
  }

  const sensorsBefore = entriesById(sensor, previous);
  for (const current of sensor.entries({ snapshot: next })) {
    const before = sensorsBefore.get(current.id);
    const was = before ? waterDetected(before) : null;
    const now = waterDetected(current);
    if (was !== null && now !== null && was !== now) {
      events.push({
        key: TRIGGERS.WATER_DETECTED_CHANGED,
        data: {
          device: gladys.externalIds(sensor.kind, current.id).device,
          status: now ? WATER.DETECTED : WATER.CLEARED,
          device_name: `${controllerName(current.controller)} - water sensor`,
        },
      });
    }
  }

  return events;
}
