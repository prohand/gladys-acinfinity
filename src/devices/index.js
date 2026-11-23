// -----------------------------------------------------------------------------
// Device registry.
//
// One Gladys device per AC Infinity controller, per port of a controller, and
// per plug-in sensor of an AI controller. Every blueprint exposes the same
// shape:
//   - kind                           : external id namespace, never renamed
//   - entries(hub)                   : `{ id, resource, controller }` of the snapshot
//   - build(gladys, entry)           : the discovery payload
//   - states(gladys, entry)          : the current values, as publishStates entries
//   - command(featureKey, value, entry) : the API changes a Gladys command means
//                                      (null: the feature is read-only)
//   - isReachable(entry)             : false when the controller or port is offline
//
// External ids are `ext:<selector>:<kind>:<id>`, the id being the AC Infinity
// controller id (`devId`), followed by the port number for a port and by the
// sensor port number for a sensor: renaming a controller or a port in the AC
// Infinity app keeps its history in Gladys.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { controller } from './controller.js';
import { port } from './port.js';
import { sensor } from './sensor.js';

export const DEVICE_BLUEPRINTS = [controller, port, sensor];

/** Every `{ blueprint, entry }` pair of the current snapshot. */
export function deviceEntries(hub) {
  return DEVICE_BLUEPRINTS.flatMap((blueprint) =>
    blueprint.entries(hub).map((entry) => ({ blueprint, entry })),
  );
}

/** The discovery payload: one device per controller, port and sensor. */
export function buildDiscoveredDevices(gladys, hub) {
  return deviceEntries(hub).map(({ blueprint, entry }) => blueprint.build(gladys, entry));
}

/** The current values of every device, as publishStates entries. */
export function buildStates(gladys, hub) {
  return deviceEntries(hub).flatMap(({ blueprint, entry }) => blueprint.states(gladys, entry));
}

/**
 * The transport badge of every device. AC Infinity is cloud only: `cloud`
 * while the API answers and the device reports, `unreachable` otherwise.
 */
export function buildTransportEntries(gladys, hub, { cloudReachable }) {
  return deviceEntries(hub).map(({ blueprint, entry }) => ({
    external_id: gladys.externalIds(blueprint.kind, entry.id).device,
    transport:
      cloudReachable && blueprint.isReachable(entry)
        ? DEVICE_TRANSPORTS.CLOUD
        : DEVICE_TRANSPORTS.UNREACHABLE,
  }));
}

/** The blueprint and entry behind a device external id, or null. */
export function resolveDevice(gladys, hub, externalId) {
  if (typeof externalId !== 'string') {
    return null;
  }
  for (const blueprint of DEVICE_BLUEPRINTS) {
    const prefix = gladys.externalIds(blueprint.kind, '').device;
    if (externalId.startsWith(prefix)) {
      const id = externalId.slice(prefix.length);
      const entry = blueprint.entries(hub).find((candidate) => candidate.id === id);
      return entry ? { blueprint, entry } : null;
    }
  }
  return null;
}

/**
 * Run a Gladys command on a feature, then publish the confirmed values.
 * Throws when the feature is read-only or AC Infinity refuses: the SDK then
 * acks the command as failed and Gladys shows it.
 */
export async function applyCommand(gladys, hub, { deviceExternalId, featureExternalId, value }) {
  const found = resolveDevice(gladys, hub, deviceExternalId);
  if (!found) {
    throw new Error(`Unknown AC Infinity device ${deviceExternalId}`);
  }
  const { blueprint, entry } = found;
  const featureKey = featureExternalId.slice(deviceExternalId.length + 1);
  const changes = blueprint.command(featureKey, value, entry);
  if (changes === null) {
    throw new Error(`The feature ${featureKey} of an AC Infinity ${blueprint.kind} is read-only`);
  }
  await hub.setPort(entry.controller.devId, entry.resource.port, changes);
  await gladys.publishStates(blueprint.states(gladys, entry));
  return entry;
}
