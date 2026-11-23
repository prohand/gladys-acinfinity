import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import {
  OVERVIEW_WIDGET,
  WIDGETS,
  WIDGET_ACTIONS,
  buildOverviewContent,
  refreshWidgets,
} from '../src/capabilities/widget.js';
import { ACInfinityHub } from '../src/acinfinity/hub.js';
import {
  AI_ID,
  CLASSIC_ID,
  CREDENTIALS,
  createFakeACInfinity,
  refreshedHub,
} from './helpers/fakeACInfinity.js';

const gladys = createFakeGladys();
const controllerSetting = (id) => ({ controller: gladys.externalIds('controller', id).device });

test('the overview is rendered exactly as sent, for every controller or one', async () => {
  const hub = await refreshedHub();
  for (const units of ['metric', 'imperial']) {
    for (const settings of [{}, controllerSetting(CLASSIC_ID), controllerSetting(AI_ID)]) {
      const content = buildOverviewContent(gladys, hub, { units, settings });
      // [] = nothing the core would drop, truncate or trim to the budget.
      assert.deepEqual(validateWidgetContent(content), []);
    }
  }
});

test('one controller: its readings, its ports, the ports running', async () => {
  const hub = await refreshedHub();
  const content = buildOverviewContent(gladys, hub, {
    units: 'metric',
    settings: controllerSetting(CLASSIC_ID),
  });
  const tiles = content.components.filter((c) => c.type === 'value');
  assert.deepEqual(
    tiles.map((t) => t.value),
    ['24.2 °C', '55.3 %', '1.34 kPa', '2/4'],
  );
  const status = content.components.find((c) => c.type === 'status');
  assert.equal(status.items.length, 4);
  assert.equal(status.items[1].label, 'Exhaust Fan');
  assert.equal(status.items[1].value.en, 'On · 5/10 · On');
  assert.equal(status.items[0].value.fr, 'Allumé · 8/10 · Programme');
  assert.equal(status.items[3].value.en, 'Offline');
  const imperial = buildOverviewContent(gladys, hub, {
    units: 'imperial',
    settings: controllerSetting(CLASSIC_ID),
  });
  assert.match(imperial.components.find((c) => c.type === 'value').value, /°F/);
});

test('every controller: one row per controller, then the ports', async () => {
  const hub = await refreshedHub();
  const content = buildOverviewContent(gladys, hub, { units: 'metric', settings: {} });
  const status = content.components.find((c) => c.type === 'status');
  assert.equal(status.items[0].label, 'Grow Tent');
  assert.equal(status.items[1].label, 'Veg Room');
  assert.equal(status.items[2].label, 'Grow Tent - Grow Lights');
  assert.equal(status.items.length, 8);
});

test('a port setting shows the controller of that port', async () => {
  const hub = await refreshedHub();
  const content = buildOverviewContent(gladys, hub, {
    settings: { controller: gladys.externalIds('port', `${AI_ID}-1`).device },
  });
  const status = content.components.find((c) => c.type === 'status');
  assert.deepEqual(
    status.items.map((i) => i.label),
    ['Humidifier', 'Heater'],
  );
});

test('empty states are valid too: not configured, not refreshed yet, cloud down, no controller', async () => {
  const empty = new ACInfinityHub();
  assert.deepEqual(validateWidgetContent(buildOverviewContent(gladys, empty)), []);
  const waiting = createFakeACInfinity().createHub();
  waiting.configure(CREDENTIALS);
  assert.deepEqual(validateWidgetContent(buildOverviewContent(gladys, waiting)), []);
  const down = await refreshedHub();
  down.lastError = new Error('down');
  const content = buildOverviewContent(gladys, down);
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[0].type, 'text');
  const none = await refreshedHub(createFakeACInfinity({ controllers: [] }));
  assert.deepEqual(validateWidgetContent(buildOverviewContent(gladys, none)), []);
});

test('every button of the overview is handled', async () => {
  const fake = createFakeACInfinity();
  const fakeGladys = createFakeGladys({ config: CREDENTIALS });
  const app = registerHandlers(fakeGladys, { hub: fake.createHub() });
  await fakeGladys.connect();
  try {
    const content = buildOverviewContent(fakeGladys, app.hub, {
      settings: controllerSetting(CLASSIC_ID),
    });
    const buttons = content.components.filter((c) => c.type === 'button');
    assert.deepEqual(
      buttons.map((b) => b.action.key),
      [WIDGET_ACTIONS.SET_PORT, WIDGET_ACTIONS.REFRESH],
    );

    const refresh = await fakeGladys.fake.widgetAction(OVERVIEW_WIDGET, WIDGET_ACTIONS.REFRESH);
    assert.equal(refresh.success, true, refresh.error);

    // The form: port 3 to On at level 4.
    const set = await fakeGladys.fake.widgetAction(
      OVERVIEW_WIDGET,
      WIDGET_ACTIONS.SET_PORT,
      {},
      { values: { port: `${CLASSIC_ID}-3`, mode: 'on', speed: 4 } },
    );
    assert.equal(set.success, true, set.error);
    assert.equal(fake.settings.get(`${CLASSIC_ID}/3`).onSpead, 4);
    assert.equal(fake.settings.get(`${CLASSIC_ID}/3`).atType, 2);

    // A mode without a level.
    await fakeGladys.fake.widgetAction(
      OVERVIEW_WIDGET,
      WIDGET_ACTIONS.SET_PORT,
      {},
      { values: { port: `${CLASSIC_ID}-3`, mode: 'schedule' } },
    );
    assert.equal(fake.settings.get(`${CLASSIC_ID}/3`).atType, 7);
  } finally {
    app.sync.stop();
    await fakeGladys.disconnect();
  }
});

test('the widget content goes through onWidgetGet', async () => {
  const fake = createFakeACInfinity();
  const fakeGladys = createFakeGladys({ config: CREDENTIALS });
  const app = registerHandlers(fakeGladys, { hub: fake.createHub() });
  await fakeGladys.connect();
  try {
    const ack = await fakeGladys.fake.widgetGet(OVERVIEW_WIDGET);
    assert.equal(ack.success, true);
  } finally {
    app.sync.stop();
    await fakeGladys.disconnect();
  }
});

test('an unknown widget action or mode fails, so the user sees the error', async () => {
  const hub = await refreshedHub();
  const widget = WIDGETS[OVERVIEW_WIDGET];
  await assert.rejects(
    widget.action(gladys, { actionKey: 'unknown', values: {}, hub }),
    /Unknown widget action/,
  );
  await assert.rejects(
    widget.action(gladys, {
      actionKey: WIDGET_ACTIONS.SET_PORT,
      values: { port: `${CLASSIC_ID}-1`, mode: 'turbo' },
      hub,
    }),
    /Unknown AC Infinity mode/,
  );
});

test('refreshWidgets nudges every widget', () => {
  const fresh = createFakeGladys();
  refreshWidgets(fresh);
  assert.deepEqual(fresh.fake.widgetRefreshes, Object.keys(WIDGETS));
});
