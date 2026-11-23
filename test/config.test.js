import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  MAX_POLL_FREQUENCY,
  MIN_POLL_FREQUENCY,
  normalizeConfig,
} from '../src/config.js';

test('normalizeConfig returns the defaults when called with no argument', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('normalizeConfig trims the e-mail but keeps the password as typed', () => {
  const config = normalizeConfig({ email: ' grower@example.com ', password: ' secret ' });
  assert.equal(config.email, 'grower@example.com');
  assert.equal(config.password, ' secret ');
});

test('normalizeConfig coerces and bounds the refresh interval', () => {
  assert.equal(normalizeConfig({ poll_frequency: '300' }).poll_frequency, 300);
  assert.equal(normalizeConfig({ poll_frequency: 5 }).poll_frequency, MIN_POLL_FREQUENCY);
  assert.equal(normalizeConfig({ poll_frequency: 99999 }).poll_frequency, MAX_POLL_FREQUENCY);
  assert.equal(normalizeConfig({ poll_frequency: 'abc' }).poll_frequency, 60);
});
