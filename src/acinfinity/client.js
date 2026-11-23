// -----------------------------------------------------------------------------
// AC Infinity cloud API client (https://www.acinfinityserver.com).
//
// The UIS controllers (69 Pro, 69 Pro+, AI+, Outlet AI...) report to the AC
// Infinity cloud over Wi-Fi; the app and this integration read and change them
// through that cloud. There is no local API reachable from Gladys (the
// controllers only speak Bluetooth locally).
//
// The API is the one of the mobile app, not documented by AC Infinity:
//   - POST /api/user/appUserLogin      e-mail + password -> `appId`, the token
//   - POST /api/user/devInfoListAll    every controller, its ports and readings
//   - POST /api/dev/getdevModeSettingList   the mode settings of one port
//   - POST /api/dev/addDevMode?...     change a port (classic controllers)
//   - PUT  /api/dev/modeAndSetting?... change a port (AI controllers)
// Every answer is `{ code, msg, data }`; `code` 200 means success, whatever
// the HTTP status.
//
// Never log the password nor the token.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  AI_CONTROLLER_TYPES,
  DEVICE_CONTROL_KEYS,
  MODE_AND_SETTING_KEYS,
  modeAndSettingIds,
} from './constants.js';

const logger = createLogger({ name: 'acinfinity-api' });

export const ACINFINITY_BASE_URL = 'https://www.acinfinityserver.com';

export const PATHS = {
  LOGIN: '/api/user/appUserLogin',
  CONTROLLERS: '/api/user/devInfoListAll',
  PORT_SETTINGS: '/api/dev/getdevModeSettingList',
  SET_PORT: '/api/dev/addDevMode',
  SET_PORT_AI: '/api/dev/modeAndSetting',
};

// The mobile app identifies itself this way; the API answers the same.
const USER_AGENT = 'okhttp/4.12.0';
const REQUEST_TIMEOUT_MS = 20_000;
// The API refuses longer passwords; the app silently cuts them, so must we.
export const MAX_PASSWORD_LENGTH = 25;

/** The e-mail or password was refused: retrying the same ones will not help. */
export class ACInfinityAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ACInfinityAuthError';
  }
}

/** Any other failure of the API (network, HTTP error, refused request...). */
export class ACInfinityApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'ACInfinityApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Parse a JSON answer without losing the controller ids: they are integers of
 * up to 20 digits, beyond what a JavaScript number holds exactly. Every
 * integer literal of 16 digits or more becomes a string first.
 */
export function parseJson(text) {
  return JSON.parse(text.replace(/([:[,]\s*)(-?\d{16,})(?=\s*[,\]}])/g, '$1"$2"'));
}

/** `true` for a controller whose port changes go through `modeAndSetting`. */
export function isAiController(controller) {
  return AI_CONTROLLER_TYPES.has(Number(controller?.devType));
}

/**
 * The full payload of a port change: for each key, the new value, else the
 * current one, else 0. The API wants flat strings: objects and arrays as JSON,
 * booleans as `true` / `false`.
 */
export function transferValues(keys, changes, existing) {
  const values = {};
  for (const key of keys) {
    const value = key in changes ? changes[key] : existing?.[key];
    if (value === null || value === undefined) {
      values[key] = '0';
    } else if (typeof value === 'object') {
      values[key] = JSON.stringify(value);
    } else {
      values[key] = String(value);
    }
  }
  return values;
}

export class ACInfinityClient {
  /**
   * @param {{ email: string, password: string, fetch?: typeof fetch, baseUrl?: string }} options
   */
  constructor({ email, password, fetch = globalThis.fetch, baseUrl }) {
    this.email = email;
    this.password = password;
    this.fetch = fetch;
    this.baseUrl = baseUrl ?? ACINFINITY_BASE_URL;
    this.token = null;
    this.pendingLogin = null;
  }

  /** The token, logging in only when there is none. Parallel calls share one login. */
  async getToken() {
    if (this.token) {
      return this.token;
    }
    if (!this.pendingLogin) {
      this.pendingLogin = this.login().finally(() => {
        this.pendingLogin = null;
      });
    }
    return this.pendingLogin;
  }

  async login() {
    const body = await this.send('POST', PATHS.LOGIN, {
      form: {
        appEmail: this.email,
        appPasswordl: String(this.password).slice(0, MAX_PASSWORD_LENGTH),
      },
    });
    if (body?.code !== 200 || !body?.data?.appId) {
      throw new ACInfinityAuthError(
        `AC Infinity refused the e-mail or password (${body?.msg ?? body?.code ?? 'no answer'})`,
      );
    }
    this.token = String(body.data.appId);
    logger.debug('AC Infinity login succeeded');
    return this.token;
  }

  /** Forget the token, so the next request logs in again. */
  resetToken(refused = this.token) {
    if (this.token === refused) {
      this.token = null;
    }
  }

  /** Every controller of the account, with its ports and current readings. */
  async listControllers() {
    const token = await this.getToken();
    const data = await this.request('POST', PATHS.CONTROLLERS, { form: { userId: token } });
    return Array.isArray(data) ? data : [];
  }

  /** The mode settings of one port of a controller. */
  async getPortSettings(devId, port) {
    return (
      (await this.request('POST', PATHS.PORT_SETTINGS, {
        form: { devId: String(devId), port: String(port) },
      })) ?? {}
    );
  }

  /**
   * Change the mode of a port, e.g. `{ atType: 2, onSpead: 7 }`. The API wants
   * the whole mode again: the current settings are read first, the changes
   * applied on top. Resolves with the values sent.
   *
   * @param {object} controller a controller of `listControllers()`
   * @param {number} port the port number (1 to 8)
   * @param {Record<string, number>} changes the API fields to change
   */
  async setPort(controller, port, changes) {
    const devId = String(controller.devId);
    const existing = await this.getPortSettings(devId, port);
    if (isAiController(controller)) {
      const flattened = { ...(existing.devSetting ?? {}), ...existing };
      const values = transferValues(MODE_AND_SETTING_KEYS, { devId, port, ...changes }, flattened);
      values.modeAndSettingIdStr = modeAndSettingIds(values.atType);
      await this.request('PUT', PATHS.SET_PORT_AI, {
        query: values,
        headers: { minversion: '3.5' },
        retry: false,
      });
      return values;
    }
    const values = transferValues(DEVICE_CONTROL_KEYS, { devId, ...changes }, existing);
    await this.request('POST', PATHS.SET_PORT, { query: values, retry: false });
    return values;
  }

  /**
   * One authenticated request; resolves with `data`. A refused read logs in
   * again once (the token may have been revoked by a login from the app).
   * A change is never sent twice.
   */
  async request(method, path, { form, query, headers = {}, retry = true } = {}) {
    const token = await this.getToken();
    const body = await this.send(method, path, { form, query, headers: { ...headers, token } });
    if (body?.code === 200) {
      return body.data ?? null;
    }
    if (retry) {
      logger.debug(`AC Infinity refused ${path} (${body?.code}), logging in again`);
      this.resetToken(token);
      return this.request(method, path, { form, query, headers, retry: false });
    }
    throw new ACInfinityApiError(
      `AC Infinity API ${path} refused (${body?.code ?? 'no code'}${body?.msg ? `: ${body.msg}` : ''})`,
      { code: body?.code },
    );
  }

  /** One HTTP exchange, parsed. Network and HTTP errors become ACInfinityApiError. */
  async send(method, path, { form, query, headers = {} } = {}) {
    const search = query ? `?${new URLSearchParams(query)}` : '';
    let response;
    try {
      response = await this.fetch(`${this.baseUrl}${path}${search}`, {
        method,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'application/json',
          ...(form ? { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' } : {}),
          ...headers,
        },
        body: form ? new URLSearchParams(form) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new ACInfinityApiError(`AC Infinity API unreachable: ${err.message}`);
    }
    if (!response.ok) {
      throw new ACInfinityApiError(`AC Infinity API ${path} failed (HTTP ${response.status})`, {
        status: response.status,
      });
    }
    try {
      return parseJson(await response.text());
    } catch {
      throw new ACInfinityApiError(`AC Infinity API ${path} sent an unreadable answer`);
    }
  }
}
