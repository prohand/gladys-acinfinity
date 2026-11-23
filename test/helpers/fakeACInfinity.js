// -----------------------------------------------------------------------------
// An in-memory AC Infinity cloud, answering the requests ACInfinityClient
// sends through the `fetch` it is given. No network in the tests.
//
// `fake.controllers` holds the `devInfoListAll` answer (edit it to simulate a
// change made in the AC Infinity app); `fake.settings` the mode settings of
// each port; `fake.requests` records every call; `fake.failNext(body, path)` /
// `fake.down = true` simulate errors.
// -----------------------------------------------------------------------------

import { ACInfinityClient } from '../../src/acinfinity/client.js';
import { ACInfinityHub } from '../../src/acinfinity/hub.js';

export const CREDENTIALS = { email: 'grower@example.com', password: 'hunter2' };

// Ids beyond Number.MAX_SAFE_INTEGER, as the real API sends them.
export const CLASSIC_ID = '54929097239553773072';
export const AI_ID = '87210463819275016439';

const port = (number, name, { speak = 0, loadState = 0, curMode = 1, online = 1 } = {}) => ({
  port: number,
  portName: name,
  speak,
  loadState,
  curMode,
  online,
  remainTime: 0,
});

/** A classic 69 Pro with 4 ports, and an AI+ with 2 ports and 3 sensors. */
export function sampleControllers() {
  return [
    {
      devId: CLASSIC_ID,
      devName: 'Grow Tent',
      devType: 11,
      online: 1,
      devMacAddr: '2B120D62DC00',
      deviceInfo: {
        temperature: 2417,
        humidity: 5530,
        vpdnums: 134,
        ports: [
          port(1, 'Grow Lights', { speak: 8, loadState: 1, curMode: 7 }),
          port(2, 'Exhaust Fan', { speak: 5, loadState: 1, curMode: 2 }),
          port(3, 'Circulating Fan', { speak: 0, loadState: 0, curMode: 3 }),
          port(4, 'Port 4', { online: 0 }),
        ],
      },
    },
    {
      devId: AI_ID,
      devName: 'Veg Room',
      devType: 20,
      online: 1,
      devMacAddr: '3C450E78AB12',
      deviceInfo: {
        ports: [
          port(1, 'Humidifier', { speak: 0, loadState: 0, curMode: 1 }),
          port(2, 'Heater', { speak: 6, loadState: 1, curMode: 3 }),
        ],
        sensors: [
          // The controller itself, in °F and °C.
          { sensorType: 4, sensorUnit: 0, sensorPrecision: 3, accessPort: 7, sensorData: 7480 },
          { sensorType: 5, sensorUnit: 1, sensorPrecision: 3, accessPort: 7, sensorData: 2378 },
          { sensorType: 6, sensorUnit: 0, sensorPrecision: 3, accessPort: 7, sensorData: 3080 },
          { sensorType: 7, sensorUnit: 0, sensorPrecision: 3, accessPort: 7, sensorData: 204 },
          // A probe on sensor port 1 (°F only).
          { sensorType: 0, sensorUnit: 0, sensorPrecision: 3, accessPort: 1, sensorData: 7610 },
          { sensorType: 2, sensorUnit: 0, sensorPrecision: 3, accessPort: 1, sensorData: 3160 },
          { sensorType: 3, sensorUnit: 0, sensorPrecision: 3, accessPort: 1, sensorData: 205 },
          // CO2 + light on sensor port 2.
          { sensorType: 11, sensorUnit: 0, sensorPrecision: 1, accessPort: 2, sensorData: 723 },
          { sensorType: 12, sensorUnit: 0, sensorPrecision: 2, accessPort: 2, sensorData: 79 },
          // Water sensor on sensor port 4.
          { sensorType: 20, sensorUnit: 0, sensorPrecision: 1, accessPort: 4, sensorData: 0 },
        ],
      },
    },
  ];
}

/** The mode settings of a port, as getdevModeSettingList answers them. */
function sampleSettings(devId, number, ai) {
  const base = {
    devId,
    externalPort: number,
    modeSetid: '8473928473928473928',
    atType: 1,
    onSpead: 7,
    offSpead: 0,
    onSelfSpead: 7,
    schedStartTime: 65535,
    schedEndtTime: 65535,
    devHt: 30,
    activeHt: 1,
    vpdnums: null,
  };
  return ai ? { ...base, devSetting: { devCompany: 1, loadType: 1, sensorSettingStr: [] } } : base;
}

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  // Raw text, like the real API: the ids are bare 20-digit integers.
  text: async () => JSON.stringify(body).replace(/"devId":"(\d{16,})"/g, '"devId":$1'),
});

export function createFakeACInfinity({ controllers = sampleControllers() } = {}) {
  const fake = {
    controllers,
    settings: new Map(),
    requests: [],
    tokensIssued: 0,
    down: false,
    failures: [],
    /** The next request (to `path`, when given) answers this body (HTTP 200). */
    failNext(body = { code: 500, msg: 'Server error' }, path = null) {
      fake.failures.push({ body, path });
    },
  };

  for (const controller of controllers) {
    const ai = [20, 21, 22].includes(controller.devType);
    for (const p of controller.deviceInfo.ports) {
      fake.settings.set(
        `${controller.devId}/${p.port}`,
        sampleSettings(controller.devId, p.port, ai),
      );
    }
  }

  fake.fetch = async (url, init = {}) => {
    const { pathname, searchParams } = new URL(url);
    const method = init.method ?? 'GET';
    const form = init.body instanceof URLSearchParams ? Object.fromEntries(init.body) : {};
    const query = Object.fromEntries(searchParams);
    fake.requests.push({ method, path: pathname, form, query, headers: init.headers ?? {} });
    if (fake.down) {
      throw new Error('getaddrinfo ENOTFOUND www.acinfinityserver.com');
    }
    const failure = fake.failures.findIndex((f) => f.path === null || f.path === pathname);
    if (failure !== -1) {
      return json(200, fake.failures.splice(failure, 1)[0].body);
    }

    if (pathname === '/api/user/appUserLogin') {
      if (
        form.appEmail !== CREDENTIALS.email ||
        form.appPasswordl !== CREDENTIALS.password.slice(0, 25)
      ) {
        return json(200, { code: 10001, msg: 'Incorrect email or password' });
      }
      fake.tokensIssued += 1;
      return json(200, {
        code: 200,
        msg: 'Success',
        data: { appId: `token-${fake.tokensIssued}` },
      });
    }

    if (init.headers?.token !== `token-${fake.tokensIssued}`) {
      return json(200, { code: 10002, msg: 'Token invalid' });
    }

    if (pathname === '/api/user/devInfoListAll' && method === 'POST') {
      return json(200, { code: 200, msg: 'Success', data: structuredClone(fake.controllers) });
    }
    if (pathname === '/api/dev/getdevModeSettingList' && method === 'POST') {
      const settings = fake.settings.get(`${form.devId}/${form.port}`);
      return settings
        ? json(200, { code: 200, msg: 'Success', data: structuredClone(settings) })
        : json(200, { code: 404, msg: 'Device not found' });
    }
    if (
      (pathname === '/api/dev/addDevMode' && method === 'POST') ||
      (pathname === '/api/dev/modeAndSetting' && method === 'PUT')
    ) {
      const portNumber = query.port ?? query.externalPort;
      const key = `${query.devId}/${portNumber}`;
      const settings = fake.settings.get(key);
      if (!settings) {
        return json(200, { code: 404, msg: 'Device not found' });
      }
      for (const field of ['atType', 'onSpead', 'offSpead', 'onSelfSpead']) {
        settings[field] = Number(query[field]);
      }
      // The controller applies the mode: On runs at the On level, Off at the Off level.
      const controller = fake.controllers.find((c) => c.devId === query.devId);
      const p = controller.deviceInfo.ports.find((item) => item.port === Number(portNumber));
      p.curMode = settings.atType;
      if (settings.atType === 2 || settings.atType === 1) {
        const ai = pathname.endsWith('modeAndSetting');
        p.speak =
          settings.atType === 1 ? settings.offSpead : ai ? settings.onSelfSpead : settings.onSpead;
        p.loadState = p.speak > 0 ? 1 : 0;
      }
      return json(200, { code: 200, msg: 'Success', data: null });
    }
    return json(404, {});
  };

  fake.createClient = ({ email, password }) =>
    new ACInfinityClient({
      email,
      password,
      fetch: fake.fetch,
      baseUrl: 'https://acinfinity.test',
    });

  fake.createHub = () => new ACInfinityHub({ createClient: fake.createClient });

  /** A controller of the fake cloud. */
  fake.controller = (devId) => fake.controllers.find((c) => c.devId === devId);

  /** A port of the fake cloud, to change it "in the AC Infinity app". */
  fake.port = (devId, number) =>
    fake.controller(devId).deviceInfo.ports.find((p) => p.port === number);

  return fake;
}

/** A hub already configured and refreshed against a fake AC Infinity. */
export async function refreshedHub(fake = createFakeACInfinity()) {
  const hub = fake.createHub();
  hub.configure(CREDENTIALS);
  await hub.refresh();
  return hub;
}
