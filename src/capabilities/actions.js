// -----------------------------------------------------------------------------
// Manifest `actions`: the buttons of the Configuration screen.
//
// The resolved message is shown under the button, in the reader's language.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { localize, pick } from '../i18n.js';
import { STATUS_MESSAGES } from '../sync.js';

const logger = createLogger({ name: 'actions' });

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

const WORDS = {
  en: {
    controller: ['controller', 'controllers'],
    port: ['port', 'ports'],
    sensor: ['sensor', 'sensors'],
  },
  fr: {
    controller: ['contrôleur', 'contrôleurs'],
    port: ['port', 'ports'],
    sensor: ['capteur', 'capteurs'],
  },
  de: {
    controller: ['Controller', 'Controller'],
    port: ['Port', 'Ports'],
    sensor: ['Sensor', 'Sensoren'],
  },
  es: {
    controller: ['controlador', 'controladores'],
    port: ['puerto', 'puertos'],
    sensor: ['sensor', 'sensores'],
  },
};

const CONNECTED = {
  en: 'Connected to AC Infinity',
  fr: 'Connecté à AC Infinity',
  de: 'Mit AC Infinity verbunden',
  es: 'Conectado a AC Infinity',
};
const OFFLINE = { en: 'offline', fr: 'hors ligne', de: 'offline', es: 'sin conexión' };

/** "Connected to AC Infinity: 1 controller, 4 ports, 1 sensor (1 offline)." */
export function connectionReport(counts) {
  return localize((language) => {
    const words = WORDS[language] ?? WORDS.en;
    const parts = [
      plural(counts.controllers, ...words.controller),
      plural(counts.ports, ...words.port),
      ...(counts.sensors > 0 ? [plural(counts.sensors, ...words.sensor)] : []),
    ].join(', ');
    const offline = counts.offline > 0 ? ` (${counts.offline} ${pick(language, OFFLINE)})` : '';
    // French puts a space before the colon.
    const colon = language === 'fr' ? ' :' : ':';
    return `${pick(language, CONNECTED)}${colon} ${parts}${offline}.`;
  });
}

export const ACTIONS = {
  // A refresh like the loop's, with the discovery list published again: the
  // devices appear in the Discovery tab right after.
  async test_connection(gladys, { sync }) {
    logger.info('Action test_connection');
    const result = await sync.run({ publishDevices: true });
    if (result.ok) {
      return connectionReport(result.counts);
    }
    if (result.reason === 'missing-credentials') {
      return STATUS_MESSAGES.missingCredentials;
    }
    return result.reason === 'auth' ? STATUS_MESSAGES.authRefused : STATUS_MESSAGES.unreachable;
  },
};
