// -----------------------------------------------------------------------------
// Scene triggers (found by comparing two refreshes) and scene actions.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import { TRIGGERS, detectSceneEvents } from '../src/capabilities/triggers.js';
import { SCENE_ACTIONS } from '../src/capabilities/scenes.js';
import {
  AI_ID,
  CLASSIC_ID,
  CREDENTIALS,
  createFakeACInfinity,
  refreshedHub,
} from './helpers/fakeACInfinity.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const gladys = createFakeGladys();

/** The keys a trigger's event may carry: its fields and variables. */
function declaredKeys(key) {
  const trigger = manifest.scene_triggers.find((t) => t.key === key);
  return new Set([...trigger.fields, ...trigger.variables].map((entry) => entry.key));
}

async function twoRefreshes(change) {
  const fake = createFakeACInfinity();
  const hub = await refreshedHub(fake);
  const previous = hub.snapshot;
  change(fake);
  await hub.refresh();
  return detectSceneEvents(gladys, previous, hub.snapshot);
}

test('the first refresh fires nothing', async () => {
  const hub = await refreshedHub();
  assert.deepEqual(detectSceneEvents(gladys, null, hub.snapshot), []);
});

test('no change, no event', async () => {
  assert.deepEqual(await twoRefreshes(() => {}), []);
});

test('a port that stops running fires port_power_changed', async () => {
  const events = await twoRefreshes((fake) => {
    Object.assign(fake.port(CLASSIC_ID, 1), { loadState: 0, speak: 0 });
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].key, TRIGGERS.PORT_POWER_CHANGED);
  assert.deepEqual(events[0].data, {
    device: gladys.externalIds('port', `${CLASSIC_ID}-1`).device,
    state: 'off',
    device_name: 'Grow Tent - Grow Lights',
    speed: 0,
  });
});

test('a controller that goes offline fires controller_connectivity_changed', async () => {
  const events = await twoRefreshes((fake) => {
    fake.controller(AI_ID).online = 0;
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].key, TRIGGERS.CONTROLLER_CONNECTIVITY_CHANGED);
  assert.equal(events[0].data.status, 'offline');
  assert.equal(events[0].data.device_name, 'Veg Room');
});

test('water detected fires water_detected_changed', async () => {
  const events = await twoRefreshes((fake) => {
    fake.controller(AI_ID).deviceInfo.sensors.find((s) => s.sensorType === 20).sensorData = 1;
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].key, TRIGGERS.WATER_DETECTED_CHANGED);
  assert.equal(events[0].data.status, 'detected');
  assert.equal(events[0].data.device, gladys.externalIds('sensor', `${AI_ID}-4`).device);
});

test('every event only carries keys its trigger declares', async () => {
  const events = await twoRefreshes((fake) => {
    fake.port(CLASSIC_ID, 2).loadState = 0;
    fake.controller(CLASSIC_ID).online = 0;
    fake.controller(AI_ID).deviceInfo.sensors.find((s) => s.sensorType === 20).sensorData = 1;
  });
  assert.equal(events.length, 3);
  for (const event of events) {
    const declared = declaredKeys(event.key);
    for (const key of Object.keys(event.data)) {
      assert.ok(declared.has(key), `${event.key}.${key} is not declared`);
    }
  }
});

test('a change made from Gladys is not read back as an event', async () => {
  const fake = createFakeACInfinity();
  const fakeGladys = createFakeGladys({ config: CREDENTIALS });
  const app = registerHandlers(fakeGladys, { hub: fake.createHub() });
  await fakeGladys.connect();
  try {
    const ack = await fakeGladys.fake.sceneAction('set_port_mode', {
      device: fakeGladys.externalIds('port', `${CLASSIC_ID}-2`).device,
      mode: 'off',
    });
    assert.equal(ack.success, true, ack.error);
    await app.sync.run();
    assert.deepEqual(fakeGladys.fake.sceneEvents, []);
  } finally {
    app.sync.stop();
    await fakeGladys.disconnect();
  }
});

test('set_port_mode sets the mode and returns it with the level', async () => {
  const fake = createFakeACInfinity();
  const hub = await refreshedHub(fake);
  const outputs = await SCENE_ACTIONS.set_port_mode(createFakeGladys(), {
    fields: { device: gladys.externalIds('port', `${CLASSIC_ID}-3`).device, mode: 'on' },
    hub,
  });
  assert.deepEqual(outputs, { mode: 'on', speed: 7 });
  assert.equal(fake.settings.get(`${CLASSIC_ID}/3`).atType, 2);
});

test('set_port_speed runs the port On at the level, 0 switches it Off', async () => {
  const fake = createFakeACInfinity();
  const hub = await refreshedHub(fake);
  const device = gladys.externalIds('port', `${AI_ID}-2`).device;
  const on = await SCENE_ACTIONS.set_port_speed(createFakeGladys(), {
    fields: { device, speed: 9 },
    hub,
  });
  assert.deepEqual(on, { mode: 'on', speed: 9 });
  const off = await SCENE_ACTIONS.set_port_speed(createFakeGladys(), {
    fields: { device, speed: 0 },
    hub,
  });
  assert.deepEqual(off, { mode: 'off', speed: 0 });
});

test('a scene action on a device that is not a port fails with a clear message', async () => {
  const hub = await refreshedHub();
  await assert.rejects(
    SCENE_ACTIONS.set_port_mode(createFakeGladys(), {
      fields: { device: gladys.externalIds('controller', CLASSIC_ID).device, mode: 'on' },
      hub,
    }),
    /not an AC Infinity port/,
  );
});

test('the scene action modes are modes the code knows', () => {
  const action = manifest.scene_actions.find((a) => a.key === 'set_port_mode');
  const options = action.fields.find((f) => f.key === 'mode').options.map((o) => o.value);
  assert.deepEqual(options, [
    'off',
    'on',
    'auto',
    'timer_to_on',
    'timer_to_off',
    'cycle',
    'schedule',
    'vpd',
  ]);
});
