// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys, from the `config_schema` of
// `gladys-assistant-integration.json`. This module provides the defaults and
// normalizes what Gladys sends, so the rest of the code never deals with
// `undefined` or with numbers typed as strings.
// -----------------------------------------------------------------------------

// The fastest refresh the integration allows: the AC Infinity cloud is shared
// by every user, and the controllers themselves report about once a minute.
export const MIN_POLL_FREQUENCY = 30;
export const MAX_POLL_FREQUENCY = 3600;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  email: '',
  password: '',
  // Seconds between two reads of the AC Infinity account.
  poll_frequency: 60,
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const pollFrequency = Number(raw.poll_frequency ?? DEFAULT_CONFIG.poll_frequency);
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    email: String(raw.email ?? '').trim(),
    // A password may start or end with a space: it is kept as typed.
    password: String(raw.password ?? ''),
    poll_frequency: Number.isFinite(pollFrequency)
      ? Math.min(MAX_POLL_FREQUENCY, Math.max(MIN_POLL_FREQUENCY, Math.round(pollFrequency)))
      : DEFAULT_CONFIG.poll_frequency,
  };
}
