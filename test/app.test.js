// -----------------------------------------------------------------------------
// The whole integration, driven through the fake Gladys of the SDK and a fake
// AC Infinity cloud: connection, discovery, refresh loop, commands, status.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import { STATUS_MESSAGES } from '../src/sync.js';
import { CLASSIC_ID, CREDENTIALS, createFakeACInfinity } from './helpers/fakeACInfinity.js';

const DEVICE_COUNT = 11;

async function start({ config = CREDENTIALS, fake = createFakeACInfinity() } = {}) {
  const gladys = createFakeGladys({ config });
  const app = registerHandlers(gladys, { hub: fake.createHub() });
  await gladys.connect();
  return { gladys, fake, ...app };
}

// Let the refresh the timer started run to completion.
const flush = async () => {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

const stop = async ({ gladys, sync }) => {
  sync.stop();
  await gladys.disconnect();
};

test('on connection: devices discovered, states and badges published, status connected', async () => {
  const ctx = await start();
  try {
    const { gladys } = ctx;
    assert.equal(gladys.fake.discoveredDevices.length, DEVICE_COUNT);
    assert.ok(gladys.fake.states.length > 0);
    assert.ok(gladys.fake.transports.length > 0);
    assert.equal(gladys.fake.connectionStatus.connected, true);
    assert.ok(gladys.fake.widgetRefreshes.includes('acinfinity_overview'));
  } finally {
    await stop(ctx);
  }
});

test('without credentials: no request to AC Infinity, the status says what is missing', async () => {
  const ctx = await start({ config: {} });
  try {
    assert.equal(ctx.fake.requests.length, 0);
    assert.equal(ctx.gladys.fake.connectionStatus.connected, false);
    assert.deepEqual(ctx.gladys.fake.connectionStatus.message, STATUS_MESSAGES.missingCredentials);
  } finally {
    await stop(ctx);
  }
});

test('refused credentials: the status says so', async () => {
  const ctx = await start({ config: { email: 'grower@example.com', password: 'wrong' } });
  try {
    assert.equal(ctx.gladys.fake.connectionStatus.connected, false);
    assert.deepEqual(ctx.gladys.fake.connectionStatus.message, STATUS_MESSAGES.authRefused);
  } finally {
    await stop(ctx);
  }
});

test('cloud down: devices marked unreachable, then back to cloud when it answers', async () => {
  const ctx = await start();
  try {
    const { gladys, fake, sync } = ctx;
    fake.down = true;
    const failed = await sync.run();
    assert.equal(failed.ok, false);
    assert.deepEqual(gladys.fake.connectionStatus.message, STATUS_MESSAGES.unreachable);
    assert.ok(
      gladys.fake.transports.slice(-DEVICE_COUNT).every((t) => t.transport === 'unreachable'),
    );

    fake.down = false;
    assert.equal((await sync.run()).ok, true);
    assert.equal(gladys.fake.connectionStatus.connected, true);
  } finally {
    await stop(ctx);
  }
});

test('the discovery list is published again only when the devices change', async () => {
  const ctx = await start();
  try {
    const { gladys, fake, sync } = ctx;
    const publications = () =>
      gladys.fake.requests.filter((r) => r.path === '/discovered_device').length;
    const before = publications();
    await sync.run();
    assert.equal(publications(), before, 'same devices, nothing published');

    fake.controller(CLASSIC_ID).deviceInfo.ports.push({
      port: 5,
      portName: 'Dehumidifier',
      speak: 0,
      loadState: 0,
      curMode: 1,
      online: 1,
    });
    await sync.run();
    assert.equal(publications(), before + 1);
    assert.equal(gladys.fake.discoveredDevices.length, DEVICE_COUNT + 1);
  } finally {
    await stop(ctx);
  }
});

test('a value changed in the AC Infinity app reaches Gladys at the next refresh', async () => {
  const ctx = await start();
  try {
    const { gladys, fake, sync } = ctx;
    fake.controller(CLASSIC_ID).deviceInfo.temperature = 2600;
    await sync.run();
    assert.equal(
      gladys.fake.lastState(gladys.externalIds('controller', CLASSIC_ID).feature('temperature')),
      26,
    );
  } finally {
    await stop(ctx);
  }
});

test('onSetValue turns a port off through AC Infinity', async () => {
  const ctx = await start();
  try {
    const { gladys, fake } = ctx;
    const ids = gladys.externalIds('port', `${CLASSIC_ID}-1`);
    const ack = await gladys.fake.setValue(
      { external_id: ids.device },
      { external_id: ids.feature('power') },
      0,
    );
    assert.equal(ack.success, true);
    assert.equal(fake.settings.get(`${CLASSIC_ID}/1`).atType, 1);
    assert.equal(gladys.fake.lastState(ids.feature('power')), 0);
  } finally {
    await stop(ctx);
  }
});

test('onSetValue changes the mode with the string of the select', async () => {
  const ctx = await start();
  try {
    const { gladys, fake } = ctx;
    const ids = gladys.externalIds('port', `${CLASSIC_ID}-3`);
    const ack = await gladys.fake.setValue(
      { external_id: ids.device },
      { external_id: ids.feature('mode') },
      'cycle',
    );
    assert.equal(ack.success, true);
    assert.equal(fake.settings.get(`${CLASSIC_ID}/3`).atType, 6);
  } finally {
    await stop(ctx);
  }
});

test('the scan request refreshes and publishes the devices', async () => {
  const ctx = await start();
  try {
    const before = ctx.fake.requests.length;
    await ctx.gladys.fake.scanRequest();
    assert.ok(ctx.fake.requests.length > before);
  } finally {
    await stop(ctx);
  }
});

test('new credentials from the configuration screen are used at once', async () => {
  const ctx = await start({ config: {} });
  try {
    await ctx.gladys.fake.configUpdated(CREDENTIALS);
    assert.equal(ctx.gladys.fake.connectionStatus.connected, true);
    assert.equal(ctx.gladys.fake.discoveredDevices.length, DEVICE_COUNT);
  } finally {
    await stop(ctx);
  }
});

test('the test_connection action reports what was found, in four languages', async () => {
  const ctx = await start();
  try {
    const ack = await ctx.gladys.fake.action('test_connection');
    assert.equal(ack.success, true);
    assert.equal(
      ack.data.message.en,
      'Connected to AC Infinity: 2 controllers, 6 ports, 3 sensors (1 offline).',
    );
    assert.equal(
      ack.data.message.fr,
      'Connecté à AC Infinity : 2 contrôleurs, 6 ports, 3 capteurs (1 hors ligne).',
    );
    assert.deepEqual(Object.keys(ack.data.message), ['en', 'fr', 'de', 'es']);
  } finally {
    await stop(ctx);
  }
});

test('the refresh loop runs every poll_frequency seconds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ctx = await start({ config: { ...CREDENTIALS, poll_frequency: 60 } });
  try {
    const listRequests = () =>
      ctx.fake.requests.filter((r) => r.path === '/api/user/devInfoListAll').length;
    const before = listRequests();
    t.mock.timers.tick(59_000);
    await flush();
    assert.equal(listRequests(), before, 'not yet');
    t.mock.timers.tick(1_000);
    await flush();
    assert.equal(listRequests(), before + 1);
  } finally {
    await stop(ctx);
  }
});
