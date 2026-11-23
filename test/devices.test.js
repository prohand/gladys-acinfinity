// -----------------------------------------------------------------------------
// The device blueprints: discovery payloads, readings, states, commands.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  applyCommand,
  buildDiscoveredDevices,
  buildStates,
  buildTransportEntries,
  resolveDevice,
} from '../src/devices/index.js';
import { controllerReadings, sensorValue } from '../src/acinfinity/readings.js';
import { clampSpeed, modesOf } from '../src/devices/port.js';
import { sensorModel } from '../src/devices/sensor.js';
import { AI_ID, CLASSIC_ID, createFakeACInfinity, refreshedHub } from './helpers/fakeACInfinity.js';

const gladys = createFakeGladys();
const ids = (kind, id) => gladys.externalIds(kind, id);
const stateOf = (states, externalId) =>
  states.find((s) => s.device_feature_external_id === externalId);

test('one device per controller, port and plug-in sensor, accepted by Gladys', async () => {
  const hub = await refreshedHub();
  const devices = buildDiscoveredDevices(gladys, hub);
  // 2 controllers + 6 ports + 3 sensor ports (probe, CO2 + light, water).
  assert.equal(devices.length, 11);
  const fakeGladys = createFakeGladys();
  // The fake refuses what the core refuses (category, unit, min/max...).
  await fakeGladys.publishDiscoveredDevices(buildDiscoveredDevices(fakeGladys, hub));
  assert.equal(fakeGladys.fake.discoveredDevices.length, 11);
  const names = devices.map((d) => d.name);
  assert.ok(names.includes('Grow Tent'));
  assert.ok(names.includes('Grow Tent - Exhaust Fan'));
  assert.ok(names.includes('Veg Room - CO2 + light sensor'));
});

test('every feature declares min, max, read_only and has_feedback', async () => {
  const hub = await refreshedHub();
  for (const device of buildDiscoveredDevices(gladys, hub)) {
    for (const feature of device.features) {
      assert.equal(typeof feature.read_only, 'boolean', feature.external_id);
      assert.equal(typeof feature.has_feedback, 'boolean', feature.external_id);
      assert.ok(Number.isFinite(feature.min) && Number.isFinite(feature.max), feature.external_id);
    }
  }
});

test('controller readings: deviceInfo × 100 for a classic one, sensors for an AI one', async () => {
  const hub = await refreshedHub();
  assert.deepEqual(controllerReadings(hub.controller(CLASSIC_ID)), {
    temperature: 24.17,
    humidity: 55.3,
    vpd: 1.34,
  });
  // The °C entry wins over the °F one.
  assert.deepEqual(controllerReadings(hub.controller(AI_ID)), {
    temperature: 23.78,
    humidity: 30.8,
    vpd: 2.04,
  });
});

test('sensor values follow the precision, temperatures in °C', () => {
  assert.equal(
    sensorValue({ sensorType: 0, sensorUnit: 0, sensorPrecision: 3, sensorData: 7610 }),
    24.5,
  );
  assert.equal(
    sensorValue({ sensorType: 1, sensorUnit: 1, sensorPrecision: 3, sensorData: 2450 }),
    24.5,
  );
  assert.equal(sensorValue({ sensorType: 11, sensorPrecision: 1, sensorData: 723 }), 723);
  assert.equal(sensorValue({ sensorType: 12, sensorPrecision: 2, sensorData: 79 }), 7.9);
  assert.equal(sensorValue({ sensorType: 2 }), null);
});

test('states: readings, port power / speed / mode, sensors', async () => {
  const hub = await refreshedHub();
  const states = buildStates(gladys, hub);
  const fan = ids('port', `${CLASSIC_ID}-2`);
  assert.equal(stateOf(states, fan.feature('power')).state, 1);
  assert.equal(stateOf(states, fan.feature('speed')).state, 5);
  assert.equal(stateOf(states, fan.feature('mode')).text, 'on');
  assert.equal(stateOf(states, ids('port', `${CLASSIC_ID}-1`).feature('mode')).text, 'schedule');
  assert.equal(stateOf(states, ids('controller', CLASSIC_ID).feature('temperature')).state, 24.17);
  const probe = ids('sensor', `${AI_ID}-1`);
  assert.equal(stateOf(states, probe.feature('temperature')).state, 24.5);
  assert.equal(stateOf(states, probe.feature('vpd')).state, 2.05);
  assert.equal(stateOf(states, ids('sensor', `${AI_ID}-2`).feature('co2')).state, 723);
  assert.equal(stateOf(states, ids('sensor', `${AI_ID}-4`).feature('water_detected')).state, 0);
  // The states pass the core checks.
  const fakeGladys = createFakeGladys();
  await fakeGladys.publishStates(buildStates(fakeGladys, hub));
});

test('the mode select offers the sensor modes on AI controllers only', async () => {
  const hub = await refreshedHub();
  assert.ok(!modesOf(hub.controller(CLASSIC_ID)).some((m) => m.key === 'co2'));
  assert.ok(modesOf(hub.controller(AI_ID)).some((m) => m.key === 'co2'));
  const device = buildDiscoveredDevices(gladys, hub).find(
    (d) => d.external_id === ids('port', `${CLASSIC_ID}-1`).device,
  );
  const mode = device.features.find((f) => f.type === 'select');
  assert.deepEqual(
    mode.supported_options.map((o) => o.value),
    ['off', 'on', 'auto', 'timer_to_on', 'timer_to_off', 'cycle', 'schedule', 'vpd'],
  );
});

test('transport badges: cloud, unreachable for an offline port or a cloud down', async () => {
  const hub = await refreshedHub();
  const entries = buildTransportEntries(gladys, hub, { cloudReachable: true });
  const of = (externalId) => entries.find((e) => e.external_id === externalId).transport;
  assert.equal(of(ids('controller', CLASSIC_ID).device), 'cloud');
  assert.equal(of(ids('port', `${CLASSIC_ID}-4`).device), 'unreachable');
  const down = buildTransportEntries(gladys, hub, { cloudReachable: false });
  assert.ok(down.every((e) => e.transport === 'unreachable'));
});

test('commands: power off, speed, mode — sent to AC Infinity and published', async () => {
  const fake = createFakeACInfinity();
  const hub = await refreshedHub(fake);
  const fakeGladys = createFakeGladys();
  const fan = fakeGladys.externalIds('port', `${CLASSIC_ID}-2`);
  const command = (feature, value) =>
    applyCommand(fakeGladys, hub, {
      deviceExternalId: fan.device,
      featureExternalId: fan.feature(feature),
      value,
    });

  await command('power', 0);
  assert.equal(fake.settings.get(`${CLASSIC_ID}/2`).atType, 1);
  assert.equal(fakeGladys.fake.lastState(fan.feature('power')), 0);

  await command('speed', 3);
  assert.equal(fake.settings.get(`${CLASSIC_ID}/2`).atType, 2);
  assert.equal(fake.settings.get(`${CLASSIC_ID}/2`).onSpead, 3);
  assert.equal(fakeGladys.fake.lastState(fan.feature('speed')), 3);
  assert.equal(fakeGladys.fake.lastState(fan.feature('power')), 1);

  await command('mode', 'auto');
  assert.equal(fake.settings.get(`${CLASSIC_ID}/2`).atType, 3);

  await assert.rejects(command('mode', 'co2'), /Unknown AC Infinity mode/);
});

test('an AI controller port speed goes to onSelfSpead', async () => {
  const fake = createFakeACInfinity();
  const hub = await refreshedHub(fake);
  const humidifier = gladys.externalIds('port', `${AI_ID}-1`);
  await applyCommand(createFakeGladys(), hub, {
    deviceExternalId: humidifier.device,
    featureExternalId: humidifier.feature('speed'),
    value: 6,
  });
  assert.equal(fake.settings.get(`${AI_ID}/1`).onSelfSpead, 6);
  assert.equal(hub.port(AI_ID, 1).speak, 6);
});

test('readings are read-only, unknown devices refused', async () => {
  const hub = await refreshedHub();
  const controller = ids('controller', CLASSIC_ID);
  await assert.rejects(
    applyCommand(createFakeGladys(), hub, {
      deviceExternalId: controller.device,
      featureExternalId: controller.feature('temperature'),
      value: 20,
    }),
    /read-only/,
  );
  assert.equal(resolveDevice(gladys, hub, ids('port', 'nope-1').device), null);
  assert.equal(resolveDevice(gladys, hub, undefined), null);
});

test('helpers: speed bounds and sensor models', () => {
  assert.equal(clampSpeed(12), 10);
  assert.equal(clampSpeed(-1), 0);
  assert.equal(clampSpeed('4.6'), 5);
  assert.throws(() => clampSpeed('fast'), /Invalid speed/);
  assert.equal(sensorModel([{ sensorType: 10 }]), 'Soil sensor');
  assert.equal(sensorModel([{ sensorType: 13 }]), 'Hydro sensor');
  assert.equal(sensorModel([{ sensorType: 20 }]), 'Water sensor');
  assert.equal(sensorModel([{ sensorType: 0 }]), 'Sensor probe');
});
