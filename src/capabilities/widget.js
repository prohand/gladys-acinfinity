// -----------------------------------------------------------------------------
// Dashboard widget (Gladys 5.1+, manifest `widgets`): "AC Infinity overview".
//
// Computed from the last refresh, in the core's declarative vocabulary:
//   - four tiles: temperature, humidity and VPD of the controller, ports on;
//   - a status list: every port (on / off, level, mode), preceded by the
//     controllers when several are shown, at most 10 rows;
//   - a "Control a port" button opening a short form (port, mode, level);
//   - a Refresh button.
//
// The per-instance setting `controller` binds the widget to one controller;
// empty, it shows every controller (the tiles then show the first one).
//
// The button `params` are declared here and sent back as is; the form values
// are validated by the core against the options listed here. After a
// successful action the core re-pulls the content; the refresh loop nudges it
// after every refresh.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { isControllerOnline } from '../acinfinity/hub.js';
import { controllerReadings } from '../acinfinity/readings.js';
import { modeOfAtType, modeOfKey } from '../acinfinity/constants.js';
import { applyCommand, resolveDevice } from '../devices/index.js';
import { controllerName, cleanName, numberOrNull } from '../devices/helpers.js';
import { PORT_FEATURES, MAX_SPEED, modesOf, port, portName } from '../devices/port.js';
import { localize, pick } from '../i18n.js';

const logger = createLogger({ name: 'widget' });

export const OVERVIEW_WIDGET = 'acinfinity_overview';

export const WIDGET_ACTIONS = {
  SET_PORT: 'set_port',
  REFRESH: 'refresh',
};

const MAX_STATUS_ITEMS = 10;

const T = {
  temperature: { en: 'Temperature', fr: 'Température', de: 'Temperatur', es: 'Temperatura' },
  humidity: { en: 'Humidity', fr: 'Humidité', de: 'Feuchtigkeit', es: 'Humedad' },
  vpd: { en: 'VPD', fr: 'VPD', de: 'VPD', es: 'VPD' },
  portsOn: {
    en: 'Ports on',
    fr: 'Ports allumés',
    de: 'Ports an',
    es: 'Puertos encendidos',
  },
  on: { en: 'On', fr: 'Allumé', de: 'An', es: 'Encendido' },
  off: { en: 'Off', fr: 'Éteint', de: 'Aus', es: 'Apagado' },
  offline: { en: 'Offline', fr: 'Hors ligne', de: 'Offline', es: 'Sin conexión' },
  controlPort: {
    en: 'Control a port',
    fr: 'Piloter un port',
    de: 'Port steuern',
    es: 'Controlar un puerto',
  },
  port: { en: 'Port', fr: 'Port', de: 'Port', es: 'Puerto' },
  mode: { en: 'Mode', fr: 'Mode', de: 'Modus', es: 'Modo' },
  level: {
    en: 'Level (On mode)',
    fr: 'Niveau (mode On)',
    de: 'Stufe (Modus On)',
    es: 'Nivel (modo On)',
  },
  levelHelp: {
    en: 'From 1 to 10. Only used with the On mode; empty keeps the current level.',
    fr: 'De 1 à 10. Utilisé seulement avec le mode On ; vide garde le niveau actuel.',
    de: 'Von 1 bis 10. Nur im Modus On verwendet; leer behält die aktuelle Stufe.',
    es: 'De 1 a 10. Solo se usa con el modo On; vacío mantiene el nivel actual.',
  },
  refresh: { en: 'Refresh', fr: 'Rafraîchir', de: 'Aktualisieren', es: 'Actualizar' },
  notConfigured: {
    en: 'Enter your AC Infinity e-mail and password in the integration configuration.',
    fr: "Saisissez votre e-mail et votre mot de passe AC Infinity dans la configuration de l'intégration.",
    de: 'Gib deine AC-Infinity-E-Mail und dein Passwort in der Konfiguration der Integration ein.',
    es: 'Introduzca su correo y su contraseña de AC Infinity en la configuración de la integración.',
  },
  noData: {
    en: 'No AC Infinity data yet: the first refresh is on its way.',
    fr: 'Pas encore de données AC Infinity : le premier rafraîchissement arrive.',
    de: 'Noch keine AC-Infinity-Daten: Die erste Aktualisierung läuft.',
    es: 'Aún no hay datos de AC Infinity: la primera actualización está en camino.',
  },
  noController: {
    en: 'No AC Infinity controller on this account.',
    fr: 'Aucun contrôleur AC Infinity sur ce compte.',
    de: 'Kein AC-Infinity-Controller in diesem Konto.',
    es: 'Ningún controlador AC Infinity en esta cuenta.',
  },
  cloudDown: {
    en: 'The AC Infinity cloud did not answer the last refresh.',
    fr: "Le cloud AC Infinity n'a pas répondu au dernier rafraîchissement.",
    de: 'Die AC-Infinity-Cloud hat auf die letzte Aktualisierung nicht geantwortet.',
    es: 'La nube de AC Infinity no respondió a la última actualización.',
  },
  refreshed: {
    en: 'AC Infinity data refreshed.',
    fr: 'Données AC Infinity rafraîchies.',
    de: 'AC-Infinity-Daten aktualisiert.',
    es: 'Datos de AC Infinity actualizados.',
  },
  refreshFailed: {
    en: 'The AC Infinity cloud did not answer, try again later.',
    fr: 'Le cloud AC Infinity ne répond pas, réessayez plus tard.',
    de: 'Die AC-Infinity-Cloud antwortet nicht, versuche es später erneut.',
    es: 'La nube de AC Infinity no responde, inténtelo más tarde.',
  },
  done: { en: 'Done.', fr: 'C’est fait.', de: 'Erledigt.', es: 'Hecho.' },
};

const text = (key) => localize((l) => pick(l, T[key]));

// The mode names, translated like the scene action options of the manifest.
// The AC Infinity app keeps the English names: they stay in English elsewhere.
const MODE_LABELS = {
  off: { en: 'Off', fr: 'Off (éteint)', de: 'Off (aus)', es: 'Off (apagado)' },
  on: { en: 'On', fr: 'On (allumé)', de: 'On (an)', es: 'On (encendido)' },
  timer_to_on: {
    en: 'Timer to On',
    fr: 'Minuterie vers On',
    de: 'Timer bis On',
    es: 'Temporizador a On',
  },
  timer_to_off: {
    en: 'Timer to Off',
    fr: 'Minuterie vers Off',
    de: 'Timer bis Off',
    es: 'Temporizador a Off',
  },
  cycle: { en: 'Cycle', fr: 'Cycle', de: 'Zyklus', es: 'Ciclo' },
  schedule: { en: 'Schedule', fr: 'Programme', de: 'Zeitplan', es: 'Horario' },
};

/** The name of a mode in one language. */
const modeName = (mode, language) => pick(language, MODE_LABELS[mode.key] ?? { en: mode.label });

/** A Celsius value in the viewer's unit system. */
export function formatTemperature(celsius, units) {
  if (celsius === null) {
    return '–';
  }
  if (units === 'imperial') {
    return `${Math.round(((celsius * 9) / 5 + 32) * 10) / 10} °F`;
  }
  return `${Math.round(celsius * 10) / 10} °C`;
}

const formatNumber = (value, suffix) =>
  value === null ? '–' : `${Math.round(value * 100) / 100} ${suffix}`;

/** The controllers the widget shows: the one of the setting, else all of them. */
export function shownControllers(gladys, hub, settings = {}) {
  const all = hub.snapshot.controllers;
  if (!settings.controller) {
    return all;
  }
  const found = resolveDevice(gladys, hub, settings.controller);
  const chosen = found?.entry.controller;
  return chosen ? [chosen] : all;
}

function portRow(entry, { short }) {
  const { resource, controller: controllerResource } = entry;
  const label = (
    short
      ? cleanName(resource.portName, `Port ${resource.port}`)
      : portName(controllerResource, resource)
  ).slice(0, 40);
  if (!port.isReachable(entry)) {
    return { label, icon: 'wifi-off', value: text('offline'), color: WIDGET_COLORS.DANGER };
  }
  const running = numberOrNull(resource.loadState) > 0;
  const level = numberOrNull(resource.speak);
  const mode = modeOfAtType(resource.curMode);
  return {
    label,
    icon: running ? 'zap' : 'power',
    value: localize((l) =>
      [
        pick(l, running ? T.on : T.off),
        level === null ? null : `${level}/${MAX_SPEED}`,
        mode ? modeName(mode, l) : null,
      ]
        .filter(Boolean)
        .join(' · '),
    ),
    color: running ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
  };
}

function controllerRow(resource, units) {
  const label = controllerName(resource).slice(0, 40);
  if (!isControllerOnline(resource)) {
    return { label, icon: 'cpu', value: text('offline'), color: WIDGET_COLORS.DANGER };
  }
  const readings = controllerReadings(resource);
  return {
    label,
    icon: 'cpu',
    value: `${formatTemperature(readings.temperature, units)} · ${formatNumber(readings.humidity, '%')}`,
    color: WIDGET_COLORS.SUCCESS,
  };
}

/** The "Control a port" form: the ports shown, the modes, the On level. */
function controlButton(entries) {
  const [first] = entries;
  const modes = modesOf(first.controller);
  return {
    type: 'button',
    label: text('controlPort'),
    icon: 'sliders',
    style: 'primary',
    action: {
      key: WIDGET_ACTIONS.SET_PORT,
      fields: [
        {
          key: 'port',
          type: 'select',
          label: text('port'),
          required: true,
          default: first.id,
          options: entries.map((entry) => ({
            value: entry.id,
            label: localize(() => portName(entry.controller, entry.resource).slice(0, 40)),
          })),
        },
        {
          key: 'mode',
          type: 'select',
          label: text('mode'),
          required: true,
          default: 'on',
          options: modes.map((mode) => ({
            value: mode.key,
            label: localize((l) => modeName(mode, l)),
          })),
        },
        {
          key: 'speed',
          type: 'number',
          label: text('level'),
          description: text('levelHelp'),
          required: false,
          min: 1,
          max: MAX_SPEED,
        },
      ],
    },
  };
}

/** The widget content for the current snapshot. */
export function buildOverviewContent(gladys, hub, { units, settings } = {}) {
  if (!hub.configured) {
    return { ttl_seconds: 300, components: [{ type: 'text', text: text('notConfigured') }] };
  }
  if (!hub.lastRefreshAt) {
    return { ttl_seconds: 30, components: [{ type: 'text', text: text('noData') }] };
  }
  const controllers = shownControllers(gladys, hub, settings);
  if (controllers.length === 0) {
    return { ttl_seconds: 300, components: [{ type: 'text', text: text('noController') }] };
  }
  const shownIds = new Set(controllers.map((c) => String(c.devId)));
  const portEntries = port
    .entries(hub)
    .filter((entry) => shownIds.has(String(entry.controller.devId)));

  const components = [];
  if (hub.lastError) {
    components.push({ type: 'text', variant: 'caption', text: text('cloudDown') });
  }

  const [first] = controllers;
  const readings = controllerReadings(first);
  const running = portEntries.filter(
    (entry) => port.isReachable(entry) && numberOrNull(entry.resource.loadState) > 0,
  ).length;
  components.push(
    {
      type: 'value',
      label: text('temperature'),
      icon: 'thermometer',
      value: formatTemperature(readings.temperature, units),
    },
    {
      type: 'value',
      label: text('humidity'),
      icon: 'droplet',
      value: formatNumber(readings.humidity, '%'),
    },
    { type: 'value', label: text('vpd'), icon: 'wind', value: formatNumber(readings.vpd, 'kPa') },
    {
      type: 'value',
      label: text('portsOn'),
      icon: 'zap',
      value: `${running}/${portEntries.length}`,
      color: isControllerOnline(first) ? WIDGET_COLORS.PRIMARY : WIDGET_COLORS.DANGER,
    },
  );

  const single = controllers.length === 1;
  const rows = [
    ...(single ? [] : controllers.map((c) => controllerRow(c, units))),
    ...portEntries.map((entry) => portRow(entry, { short: single })),
  ];
  if (rows.length > 0) {
    components.push({ type: 'status', items: rows.slice(0, MAX_STATUS_ITEMS) });
  }

  if (portEntries.length > 0) {
    components.push(controlButton(portEntries));
  }
  components.push({
    type: 'button',
    label: text('refresh'),
    icon: 'refresh-cw',
    style: 'secondary',
    action: { key: WIDGET_ACTIONS.REFRESH },
  });

  return { ttl_seconds: 300, components };
}

export const WIDGETS = {
  [OVERVIEW_WIDGET]: {
    async get(gladys, { hub, units, settings }) {
      logger.debug(`onWidgetGet <- ${OVERVIEW_WIDGET}`);
      return buildOverviewContent(gladys, hub, { units, settings });
    },

    async action(gladys, { actionKey, values = {}, hub, sync }) {
      logger.info(`onWidgetAction <- ${OVERVIEW_WIDGET}.${actionKey}`);
      if (actionKey === WIDGET_ACTIONS.REFRESH) {
        const result = await sync.run();
        return text(result.ok ? 'refreshed' : 'refreshFailed');
      }
      if (actionKey === WIDGET_ACTIONS.SET_PORT) {
        const ids = gladys.externalIds(port.kind, values.port);
        const mode = modeOfKey(String(values.mode));
        if (!mode) {
          throw new Error(`Unknown AC Infinity mode: ${values.mode}`);
        }
        const speed = numberOrNull(values.speed);
        const useSpeed = mode.key === 'on' && speed !== null;
        await applyCommand(gladys, hub, {
          deviceExternalId: ids.device,
          featureExternalId: ids.feature(useSpeed ? PORT_FEATURES.SPEED : PORT_FEATURES.MODE),
          value: useSpeed ? speed : mode.key,
        });
        return text('done');
      }
      // Throwing acks the action as failed: the message reaches the user.
      throw new Error(`Unknown widget action: ${actionKey}`);
    },
  },
};

/** Ask the core to re-pull every widget now (rate-limited core-side). */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    gladys.requestWidgetRefresh(key);
  }
}
