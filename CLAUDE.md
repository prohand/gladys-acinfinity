# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and to human contributors when
working with code in this repository.

## What this is

A Gladys Assistant **external integration** (Node 22+, ESM, no build step, one runtime
dependency: `@gladysassistant/integration-sdk`) for **AC Infinity** UIS controllers (69 Pro,
69 Pro+, AI+, Outlet AI…), through the AC Infinity **cloud** API
(`https://www.acinfinityserver.com`, the undocumented API of the mobile app: e-mail + password
login). Requires Gladys 5.3+. Started from the official template
(GladysAssistant/integration-template-js); the workflows follow prohand/gladys-devmel.

Gladys gets one device per controller (temperature, humidity, VPD), per port (power, level
0–10, mode select) and per plug-in sensor of an AI controller (probe, CO2 + light, soil, water,
pH, water temperature). Scene triggers (port on/off, controller online/offline, water detected),
scene actions (port mode, port level) and an "AC Infinity overview" widget.

## Commands

```bash
npm install
npm test                                    # node --test (built-in runner)
node --test test/devices.test.js            # one file
node --test --test-name-pattern "port"      # tests whose name matches
npm run lint                                # eslint .
npm run format:check                        # prettier --check . (CI gate)
npm run format                              # prettier --write .
npx github:GladysAssistant/integration-store --skip-image-check .   # store admission checks
```

CI runs `format:check`, `lint`, `test` on Node 22 and 24; pull requests also run the store
checks and build the image. Run the three commands before pushing.

## Architecture

```
index.js                      SDK bootstrap only (connect, shutdown)
src/app.js                    every Gladys handler, registered before connect()
src/config.js                 DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
src/i18n.js                   LANGUAGES (en, fr, de, es), localize / pick
src/acinfinity/constants.js   API codes: modes (atType), controller and sensor types, field lists
src/acinfinity/client.js      AC Infinity API: login, list, port settings, port change, errors
src/acinfinity/hub.js         last snapshot of the account + setPort() merged into it
src/acinfinity/readings.js    raw readings -> numbers (× 100, precision, °F -> °C)
src/sync.js                   refresh loop: discovery, changed states, transports, triggers, status
src/devices/                  one blueprint per device kind (controller, port, sensor)
src/capabilities/actions.js   manifest `actions` (Test the connection)
src/capabilities/triggers.js  scene triggers, found by diffing two refreshes
src/capabilities/scenes.js    scene actions
src/capabilities/widget.js    dashboard widget
docs/{en,fr,de,es}.md         user documentation, re-hosted by Gladys
test/                         node --test, fake Gladys of the SDK + test/helpers/fakeACInfinity.js
.github/scripts/changelog-release.mjs   CHANGELOG roll, run by the Release workflow
```

### Invariants worth knowing

- **External ids are forever**: `gladys.externalIds(kind, id)` with `kind` in
  `controller | port | sensor`; `id` is the controller `devId`, then `-<port>` for a port and
  `-<sensor port>` for a sensor. Never rename a kind, a feature key, a mode key
  (`PORT_MODES`), a manifest key (config, action, trigger, scene action, widget): users store
  them.
- **Controller ids are 20-digit integers**: `parseJson` turns every integer literal of 16+
  digits into a string before `JSON.parse`. Always handle `devId` as a string.
- **Cloud only.** Manifest `transports: ["cloud"]`; the badge is `cloud` when the cloud answered
  and the controller (and port) is online, `unreachable` otherwise.
- **One refresh = one request** (`devInfoListAll`) whatever the number of controllers, on our own
  timer (`poll_frequency`, seconds, 30–3600). Gladys' per-device `onPoll` is not used.
- **The mode comes from `curMode`** of the device list (no per-port request at refresh). A port
  change reads the port settings first (`getdevModeSettingList`) and sends them all back with
  the change: `addDevMode` (POST, query string) for classic controllers, `modeAndSetting` (PUT,
  query string, `minversion: 3.5`) for AI controllers (`devType` 20, 21, 22), whose On level is
  `onSelfSpead` instead of `onSpead`.
- **A change is never sent twice**: only reads re-login and retry once.
- **Changes are merged into the snapshot** (`ACInfinityHub.setPort`): Gladys sees the value at
  once and the next refresh does not read the change as an external event — a scene that turns
  a port off is never re-triggered by itself.
- **The first refresh after a start fires no trigger**: it only sets the reference.
- **Only the mode and the On level are changed** from Gladys: Auto thresholds, timers, cycles and
  schedules stay those of the AC Infinity app.
- **Every feature declares `min`/`max`.** Unknown readings are not published, never sent as 0.
  EC and TDS readings have no Gladys unit and are not published.
- **The container rootfs is read-only**: write only under `/data` (the integration currently
  writes nothing). Never log the password nor the token.

## Rules

- **Versions belong to the Release workflow** (Actions → Release). Never edit `version` in
  `package.json` or the manifest, nor the `docker_image` tag, by hand. `test/manifest.test.js`
  checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]` in
  `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`). Never write a version
  heading: the Release workflow moves the section.
- **Manifest.** Every `label`, `description` and `placeholder` is `{ en, fr, de, es }`
  (`test/manifest.test.js` enforces it). Catalog `description`: 10 to 100 characters per
  language. `keywords` and `countries` need `gladys_version >=5.3.0`.
- **User-facing text** (action answers, connection status, widget) is `{ en, fr, de, es }`, built
  with `src/i18n.js`. Docs in `docs/en.md`, `docs/fr.md`, `docs/de.md`, `docs/es.md`, kept in
  sync.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why, in English. Tests
  never touch the network.
