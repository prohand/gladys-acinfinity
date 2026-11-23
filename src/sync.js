// -----------------------------------------------------------------------------
// The refresh loop: read AC Infinity, then tell Gladys what changed.
//
// AC Infinity has no push channel, so the integration reads the account every
// `poll_frequency` seconds (one minute by default) with its own timer rather
// than Gladys' per-device poll: one refresh is ONE request for the whole
// account, however many controllers and ports it has.
//
// After each refresh:
//   1. new or removed devices -> the discovery list is published again;
//   2. the values that changed are published (publishChangedStates, with a
//      heartbeat so a steady temperature stays recently dated);
//   3. the transport badge of every device (cloud / unreachable);
//   4. the scene triggers found by comparing with the previous refresh;
//   5. the connection status of the Configuration screen, and the widget.
// -----------------------------------------------------------------------------

import { createLogger, DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { ACInfinityAuthError } from './acinfinity/client.js';
import { buildDiscoveredDevices, buildStates, buildTransportEntries } from './devices/index.js';
import { port } from './devices/port.js';
import { sensor } from './devices/sensor.js';
import { detectSceneEvents } from './capabilities/triggers.js';
import { refreshWidgets } from './capabilities/widget.js';
import { localize, pick } from './i18n.js';

const logger = createLogger({ name: 'sync' });

const STATE_HEARTBEAT_MS = 30 * 60 * 1000;

export const STATUS_MESSAGES = {
  missingCredentials: localize((l) =>
    pick(l, {
      en: 'Enter the e-mail and password of your AC Infinity account.',
      fr: 'Saisissez l’e-mail et le mot de passe de votre compte AC Infinity.',
      de: 'Gib die E-Mail und das Passwort deines AC-Infinity-Kontos ein.',
      es: 'Introduzca el correo y la contraseña de su cuenta AC Infinity.',
    }),
  ),
  authRefused: localize((l) =>
    pick(l, {
      en: 'AC Infinity refused the e-mail or password: check them in the AC Infinity app.',
      fr: 'AC Infinity a refusé l’e-mail ou le mot de passe : vérifiez-les dans l’appli AC Infinity.',
      de: 'AC Infinity hat E-Mail oder Passwort abgelehnt: prüfe sie in der AC-Infinity-App.',
      es: 'AC Infinity rechazó el correo o la contraseña: compruébelos en la app AC Infinity.',
    }),
  ),
  unreachable: localize((l) =>
    pick(l, {
      en: 'The AC Infinity cloud does not answer, retrying at the next refresh.',
      fr: 'Le cloud AC Infinity ne répond pas, nouvel essai au prochain rafraîchissement.',
      de: 'Die AC-Infinity-Cloud antwortet nicht, neuer Versuch bei der nächsten Aktualisierung.',
      es: 'La nube de AC Infinity no responde, se reintentará en la próxima actualización.',
    }),
  ),
};

/** The device external ids of a discovery list, sorted, as one string. */
function deviceSetKey(devices) {
  return devices
    .map((device) => `${device.external_id}#${device.features.length}`)
    .sort()
    .join('\n');
}

/**
 * @param {{ gladys: import('@gladysassistant/integration-sdk').GladysIntegration,
 *   hub: import('./acinfinity/hub.js').ACInfinityHub, getConfig: () => object }} context
 */
export function createSync({ gladys, hub, getConfig }) {
  let running = null;
  let timer = null;
  let stopped = true;
  let publishedDevices = null;
  let lastStatusOk = null;

  async function setStatus(ok, message) {
    lastStatusOk = ok;
    await gladys.setConnectionStatus(ok, message).catch((err) => {
      logger.warn(`Could not report the connection status: ${err.message}`);
    });
  }

  async function runOnce({ publishDevices = false } = {}) {
    if (!hub.configured) {
      await setStatus(false, STATUS_MESSAGES.missingCredentials);
      refreshWidgets(gladys);
      return { ok: false, reason: 'missing-credentials' };
    }

    const previous = hub.lastRefreshAt ? hub.snapshot : null;
    try {
      await hub.refresh();
    } catch (err) {
      const auth = err instanceof ACInfinityAuthError;
      logger.warn(`AC Infinity refresh failed: ${err.message}`);
      await setStatus(false, auth ? STATUS_MESSAGES.authRefused : STATUS_MESSAGES.unreachable);
      const entries = buildTransportEntries(gladys, hub, { cloudReachable: false });
      if (entries.length > 0) {
        await gladys.publishTransports(entries).catch(() => {});
      }
      refreshWidgets(gladys);
      return { ok: false, reason: auth ? 'auth' : 'unreachable', error: err };
    }

    // 1. Devices: only when the list changed (or on demand).
    const devices = buildDiscoveredDevices(gladys, hub);
    const key = deviceSetKey(devices);
    if (publishDevices || key !== publishedDevices) {
      await gladys.publishDiscoveredDevices(devices);
      publishedDevices = key;
    }

    // 2. Values that changed.
    const states = buildStates(gladys, hub);
    if (states.length > 0) {
      await gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });
    }

    // 3. Transport badges.
    const transports = buildTransportEntries(gladys, hub, { cloudReachable: true });
    if (transports.length > 0) {
      await gladys.publishTransports(transports);
    }

    // 4. Scene triggers. A refused event must not stop the loop.
    for (const event of detectSceneEvents(gladys, previous, hub.snapshot)) {
      logger.info(`Scene event ${event.key} <- ${event.data.device}`);
      await gladys.publishSceneEvent(event.key, event.data).catch((err) => {
        logger.warn(`Scene event ${event.key} refused: ${err.message}`);
      });
    }

    // 5. Status and widget.
    if (lastStatusOk !== true) {
      await setStatus(true);
    }
    refreshWidgets(gladys);
    return {
      ok: true,
      counts: {
        controllers: hub.snapshot.controllers.length,
        ports: port.entries(hub).length,
        sensors: sensor.entries(hub).length,
        offline: transports.filter((t) => t.transport === DEVICE_TRANSPORTS.UNREACHABLE).length,
      },
    };
  }

  /** One refresh at a time: a request made during a refresh joins it. */
  function run(options) {
    if (!running) {
      running = runOnce(options).finally(() => {
        running = null;
      });
    }
    return running;
  }

  function schedule() {
    clearTimeout(timer);
    if (stopped) {
      return;
    }
    timer = setTimeout(async () => {
      try {
        await run();
      } catch (err) {
        logger.error('AC Infinity refresh loop failed', err);
      }
      schedule();
    }, getConfig().poll_frequency * 1000);
  }

  return {
    run,
    /** Refresh now, then every `poll_frequency` seconds. */
    async start(options) {
      stopped = false;
      try {
        return await run(options);
      } finally {
        schedule();
      }
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
    },
    /** Forget what was published: the next run publishes everything again. */
    reset() {
      publishedDevices = null;
      lastStatusOk = null;
    },
  };
}
