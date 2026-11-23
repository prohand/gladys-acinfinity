// -----------------------------------------------------------------------------
// The AC Infinity API client against the fake cloud: login, big ids, retries,
// port changes for classic and AI controllers, errors.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACInfinityApiError,
  ACInfinityAuthError,
  ACInfinityClient,
  parseJson,
  transferValues,
} from '../src/acinfinity/client.js';
import { AI_ID, CLASSIC_ID, CREDENTIALS, createFakeACInfinity } from './helpers/fakeACInfinity.js';

function client(fake, credentials = CREDENTIALS) {
  return fake.createClient(credentials);
}

test('parseJson keeps the 20-digit controller ids exact', () => {
  const parsed = parseJson('{"data":[{"devId":54929097239553773072,"port":1,"temp":2417}]}');
  assert.equal(parsed.data[0].devId, '54929097239553773072');
  assert.equal(parsed.data[0].port, 1);
  assert.equal(parsed.data[0].temp, 2417);
});

test('login sends the e-mail and the password cut to 25 characters', async () => {
  const fake = createFakeACInfinity();
  const long = 'p'.repeat(30);
  const c = new ACInfinityClient({ email: 'a@b.c', password: long, fetch: fake.fetch });
  await assert.rejects(c.login(), ACInfinityAuthError);
  assert.equal(fake.requests[0].form.appPasswordl, 'p'.repeat(25));
  assert.equal(fake.requests[0].form.appEmail, 'a@b.c');
  assert.equal(fake.requests[0].headers['user-agent'], 'okhttp/4.12.0');
});

test('listControllers logs in once, then sends the token', async () => {
  const fake = createFakeACInfinity();
  const c = client(fake);
  const [first, second] = await Promise.all([c.listControllers(), c.listControllers()]);
  assert.equal(first.length, 2);
  assert.equal(second[0].devId, CLASSIC_ID);
  assert.equal(fake.tokensIssued, 1, 'parallel requests share one login');
  const list = fake.requests.find((r) => r.path === '/api/user/devInfoListAll');
  assert.equal(list.form.userId, 'token-1');
  assert.equal(list.headers.token, 'token-1');
});

test('a refused read logs in again once', async () => {
  const fake = createFakeACInfinity();
  const c = client(fake);
  await c.listControllers();
  fake.tokensIssued += 1; // the app logged in: our token is no longer valid
  const controllers = await c.listControllers();
  assert.equal(controllers.length, 2);
  assert.equal(c.token, `token-${fake.tokensIssued}`);
});

test('a read refused twice is an API error with the code', async () => {
  const fake = createFakeACInfinity();
  const c = client(fake);
  await c.getToken();
  // Refused, then refused again after a fresh login.
  fake.failNext({ code: 500, msg: 'Server busy' }, '/api/user/devInfoListAll');
  fake.failNext({ code: 500, msg: 'Server busy' }, '/api/user/devInfoListAll');
  await assert.rejects(c.listControllers(), (err) => {
    assert.ok(err instanceof ACInfinityApiError);
    assert.equal(err.code, 500);
    assert.match(err.message, /Server busy/);
    return true;
  });
  assert.equal(fake.tokensIssued, 2, 'one fresh login before giving up');
});

test('network and HTTP failures are API errors', async () => {
  const fake = createFakeACInfinity();
  fake.down = true;
  await assert.rejects(client(fake).listControllers(), ACInfinityApiError);
  const http = new ACInfinityClient({
    ...CREDENTIALS,
    fetch: async () => ({ ok: false, status: 502, text: async () => '' }),
  });
  await assert.rejects(http.login(), /HTTP 502/);
});

test('a classic controller port changes through addDevMode, with every setting sent again', async () => {
  const fake = createFakeACInfinity();
  const c = client(fake);
  const [controller] = await c.listControllers();
  const sent = await c.setPort(controller, 2, { atType: 2, onSpead: 9 });
  assert.equal(sent.atType, '2');
  assert.equal(sent.onSpead, '9');
  const write = fake.requests.at(-1);
  assert.equal(write.method, 'POST');
  assert.equal(write.path, '/api/dev/addDevMode');
  assert.equal(write.query.devId, CLASSIC_ID);
  assert.equal(write.query.schedStartTime, '65535', 'unchanged settings are kept');
  assert.equal(write.query.vpdnums, '0', 'a null setting is sent as 0');
  assert.equal(fake.port(CLASSIC_ID, 2).speak, 9);
});

test('an AI controller port changes through modeAndSetting', async () => {
  const fake = createFakeACInfinity();
  const c = client(fake);
  const controller = (await c.listControllers()).find((item) => item.devId === AI_ID);
  await c.setPort(controller, 1, { atType: 2, onSelfSpead: 4 });
  const write = fake.requests.at(-1);
  assert.equal(write.method, 'PUT');
  assert.equal(write.path, '/api/dev/modeAndSetting');
  assert.equal(write.headers.minversion, '3.5');
  assert.equal(write.query.port, '1');
  assert.equal(write.query.modeAndSettingIdStr, '[16,18]');
  assert.equal(write.query.devCompany, '1', 'the devSetting values are flattened in');
  assert.equal(write.query.sensorSettingStr, '[]', 'arrays are sent as JSON');
  assert.equal(fake.port(AI_ID, 1).speak, 4);
});

test('a refused change is never sent twice', async () => {
  const fake = createFakeACInfinity();
  const c = client(fake);
  const [controller] = await c.listControllers();
  await c.getPortSettings(CLASSIC_ID, 1);
  const writes = () => fake.requests.filter((r) => r.path === '/api/dev/addDevMode').length;
  // The settings read succeeds, the write is refused.
  const realFetch = fake.fetch;
  c.fetch = async (url, init) =>
    url.includes('addDevMode')
      ? (fake.requests.push({ path: '/api/dev/addDevMode' }),
        { ok: true, status: 200, text: async () => '{"code":500,"msg":"busy"}' })
      : realFetch(url, init);
  await assert.rejects(c.setPort(controller, 1, { atType: 1 }), ACInfinityApiError);
  assert.equal(writes(), 1);
});

test('transferValues: new value, else current, else 0; objects as JSON, booleans as text', () => {
  const values = transferValues(
    ['a', 'b', 'c', 'd', 'e'],
    { a: 5, e: true },
    { a: 1, b: 2, d: { x: 1 } },
  );
  assert.deepEqual(values, { a: '5', b: '2', c: '0', d: '{"x":1}', e: 'true' });
});
