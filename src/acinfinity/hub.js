// -----------------------------------------------------------------------------
// The last known picture of the AC Infinity account, and the only way to
// change it.
//
// One refresh is ONE request (`devInfoListAll`): every controller, its ports
// and its sensors, whatever their number. Devices, states, the widget and the
// scene triggers are all computed from this snapshot.
//
// A port change is sent to AC Infinity, then merged into the snapshot at once:
// Gladys shows the new value without waiting for the next refresh, and the
// next refresh does not read the change as an event coming from elsewhere.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { ACInfinityClient, isAiController } from './client.js';
import { AT_TYPE } from './constants.js';

const logger = createLogger({ name: 'acinfinity-hub' });

export function emptySnapshot() {
  return { controllers: [] };
}

/** The ports of a controller (the outlets a fan, a light... is plugged into). */
export function portsOf(controller) {
  const ports = controller?.deviceInfo?.ports;
  return Array.isArray(ports) ? ports : [];
}

/** The readings of an AI controller: its own, then those of its plug-in sensors. */
export function sensorsOf(controller) {
  const sensors = controller?.deviceInfo?.sensors;
  return Array.isArray(sensors) ? sensors : [];
}

/** `true` while the cloud hears from the controller. */
export function isControllerOnline(controller) {
  return Number(controller?.online) === 1;
}

export class ACInfinityHub {
  /**
   * @param {{ createClient?: (credentials: { email: string, password: string }) => ACInfinityClient }} [options]
   */
  constructor({ createClient = (credentials) => new ACInfinityClient(credentials) } = {}) {
    this.createClient = createClient;
    this.client = null;
    this.credentialsKey = null;
    this.snapshot = emptySnapshot();
    this.lastRefreshAt = null;
    this.lastError = null;
  }

  /** Follow the configuration: new credentials, new client, empty picture. */
  configure(config) {
    const key = `${config.email}\u0000${config.password}`;
    if (key === this.credentialsKey) {
      return;
    }
    this.credentialsKey = key;
    this.client = hasCredentials(config)
      ? this.createClient({ email: config.email, password: config.password })
      : null;
    this.snapshot = emptySnapshot();
    this.lastRefreshAt = null;
    this.lastError = null;
  }

  get configured() {
    return this.client !== null;
  }

  /** Read the whole account again. Rejects (and keeps the old picture) on failure. */
  async refresh() {
    if (!this.client) {
      throw new Error('AC Infinity e-mail or password is missing');
    }
    try {
      const controllers = await this.client.listControllers();
      this.snapshot = {
        controllers: controllers.filter((controller) => controller?.devId !== undefined),
      };
      this.lastRefreshAt = new Date();
      this.lastError = null;
      logger.debug(
        `AC Infinity refreshed: ${controllers.length} controller(s), ` +
          `${controllers.reduce((count, c) => count + portsOf(c).length, 0)} port(s)`,
      );
      return this.snapshot;
    } catch (err) {
      this.lastError = err;
      throw err;
    }
  }

  /** A controller of the snapshot by its id. */
  controller(devId) {
    return this.snapshot.controllers.find((c) => String(c.devId) === String(devId)) ?? null;
  }

  /** A port of a controller of the snapshot. */
  port(devId, portNumber) {
    return (
      portsOf(this.controller(devId)).find((p) => Number(p.port) === Number(portNumber)) ?? null
    );
  }

  /**
   * Change the mode of a port (`{ atType, onSpead... }`), then reflect it in
   * the snapshot. Resolves with the updated port.
   */
  async setPort(devId, portNumber, changes) {
    if (!this.client) {
      throw new Error('AC Infinity e-mail or password is missing');
    }
    const controller = this.controller(devId);
    const port = this.port(devId, portNumber);
    if (!controller || !port) {
      throw new Error(`Unknown AC Infinity port ${devId}/${portNumber}`);
    }
    const sent = await this.client.setPort(controller, portNumber, changes);
    const atType = Number(sent.atType);
    port.curMode = atType;
    // The level the port runs at now: the On or Off level of the mode just set.
    // In the other modes the controller decides: the next refresh tells.
    if (atType === AT_TYPE.ON || atType === AT_TYPE.OFF) {
      const level = Number(
        atType === AT_TYPE.OFF
          ? sent.offSpead
          : isAiController(controller)
            ? sent.onSelfSpead
            : sent.onSpead,
      );
      if (Number.isFinite(level)) {
        port.speak = level;
        port.loadState = level > 0 ? 1 : 0;
      }
    }
    return port;
  }
}

export function hasCredentials(config) {
  return Boolean(config.email && config.password);
}
