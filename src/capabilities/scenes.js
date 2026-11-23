// -----------------------------------------------------------------------------
// Scene actions (Gladys 5.1+, manifest `scene_actions`).
//
// Each handler receives the RESOLVED fields (a `"source": "devices"` field is
// the chosen device external_id) and resolves the declared outputs, readable
// by the next actions of the scene. Throwing fails this action only: the scene
// logs it and goes on. Choosing a device that is not a port (a controller, a
// sensor) is such a failure, with a message that says so.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { modeOfAtType } from '../acinfinity/constants.js';
import { applyCommand, resolveDevice } from '../devices/index.js';
import { PORT_FEATURES, clampSpeed, port } from '../devices/port.js';
import { numberOrNull } from '../devices/helpers.js';

const logger = createLogger({ name: 'scenes' });

/** The port behind a field, or a clear error. */
function portOf(gladys, hub, externalId) {
  const found = resolveDevice(gladys, hub, externalId);
  if (!found || found.blueprint.kind !== port.kind) {
    throw new Error(`The chosen device is not an AC Infinity port: ${externalId ?? 'none'}`);
  }
  return found.entry;
}

/** The outputs of both actions: the mode and the level of the port now. */
function outputs(entry) {
  return {
    mode: modeOfAtType(entry.resource.curMode)?.key ?? 'unknown',
    speed: numberOrNull(entry.resource.speak) ?? 0,
  };
}

async function command(gladys, hub, externalId, featureKey, value) {
  const entry = portOf(gladys, hub, externalId);
  await applyCommand(gladys, hub, {
    deviceExternalId: externalId,
    featureExternalId: gladys.externalIds(port.kind, entry.id).feature(featureKey),
    value,
  });
  return outputs(entry);
}

export const SCENE_ACTIONS = {
  async set_port_mode(gladys, { fields, hub }) {
    logger.info(`Scene action set_port_mode <- ${fields.device} = ${fields.mode}`);
    return command(gladys, hub, fields.device, PORT_FEATURES.MODE, String(fields.mode));
  },

  async set_port_speed(gladys, { fields, hub }) {
    const speed = clampSpeed(fields.speed);
    logger.info(`Scene action set_port_speed <- ${fields.device} = ${speed}`);
    return command(gladys, hub, fields.device, PORT_FEATURES.SPEED, speed);
  },
};
