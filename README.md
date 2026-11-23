# Gladys AC Infinity

[Gladys Assistant](https://gladysassistant.com) external integration for
[AC Infinity](https://acinfinity.com) UIS controllers (69 Pro, 69 Pro+, AI+,
Outlet AI…), through the AC Infinity **cloud** API.

- **Devices**: one per controller (temperature, humidity, VPD), per port (power
  on/off, level 0–10, mode) and per plug-in sensor of an AI controller (probe,
  CO2 + light, soil, water, pH, water temperature).
- **Transport badge**: `cloud` on every device, `unreachable` when the cloud
  does not answer or a controller or port is offline (manifest
  `transports: ["cloud"]`).
- **Scene triggers**: port turned on/off, controller offline/online, water
  detected/dry again.
- **Scene actions**: set the mode of a port, set the level of a port.
- **Dashboard widget**: "AC Infinity overview".
- **Countries**: the catalog lists it where AC Infinity sells its controllers
  (North America, Europe, Australia, New Zealand, Japan).
- **Languages**: English, French, German, Spanish (manifest, messages, docs).

Requires **Gladys 5.3.0** or later and an AC Infinity app account with the
controllers on Wi-Fi.

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

## How it works

```
Gladys  <── SDK (WebSocket + host API) ──>  this container  ── HTTPS ──>  www.acinfinityserver.com
```

- **Auth**: `POST /api/user/appUserLogin` with the e-mail and password of the
  AC Infinity app (cut to 25 characters, like the app does). The token is kept
  in memory and renewed when the cloud refuses it.
- **Refresh**: every `poll_frequency` seconds (60 by default, 30 minimum), one
  request reads the whole account (`/api/user/devInfoListAll`). Only the
  changed values are sent to Gladys (`publishChangedStates`, 30-minute
  heartbeat).
- **Orders**: the port settings are read (`/api/dev/getdevModeSettingList`),
  then sent back with the new mode or level: `POST /api/dev/addDevMode` for the
  classic controllers, `PUT /api/dev/modeAndSetting` for the AI ones. The
  confirmed value is published at once.
- **Triggers**: found by comparing two refreshes. The first refresh after a
  start fires nothing, and a change made from Gladys is never read back as an
  event.

The AC Infinity API is not documented: field names come from the app, as
documented by the community (Home Assistant `ac_infinity` integration).

## Project structure

```
.
├─ index.js                     # SDK bootstrap (connect, shutdown)
├─ src/
│  ├─ app.js                    # every Gladys handler
│  ├─ config.js                 # config defaults + normalization
│  ├─ i18n.js                   # en / fr / de / es helpers
│  ├─ sync.js                   # refresh loop
│  ├─ acinfinity/
│  │  ├─ constants.js           # modes, controller and sensor types, API fields
│  │  ├─ client.js              # AC Infinity API client
│  │  ├─ hub.js                 # last snapshot of the account
│  │  └─ readings.js            # raw readings -> numbers
│  ├─ devices/                  # controller, port, sensor blueprints
│  └─ capabilities/
│     ├─ actions.js             # "Test the connection"
│     ├─ triggers.js            # scene triggers
│     ├─ scenes.js              # scene actions
│     └─ widget.js              # dashboard widget
├─ docs/{en,fr,de,es}.md        # user documentation (re-hosted by Gladys)
├─ test/                        # node --test, no network
├─ gladys-assistant-integration.json
├─ Dockerfile                   # Node 24 Alpine, read-only rootfs ready
├─ CHANGELOG.md · CLAUDE.md · SECURITY.md
└─ .github/
   ├─ workflows/ci.yml          # format, lint, tests (Node 22 + 24), store checks, Docker build
   ├─ workflows/release.yml     # UI-driven release: bump + changelog + tag + build
   ├─ workflows/build.yml       # multi-arch image (amd64 + arm64) to ghcr.io
   ├─ workflows/github-release.yml # GitHub Release of every version tag
   ├─ scripts/changelog-release.mjs
   └─ dependabot.yml
```

## Development

```bash
npm install
npm test
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store --skip-image-check .
```

Run it against a Gladys instance:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="ac-infinity" \
LOG_LEVEL=debug \
npm start
```

The tests use the fake Gladys of the SDK (`createFakeGladys`) and an in-memory
AC Infinity cloud (`test/helpers/fakeACInfinity.js`): no network, no account.

## Release

1. Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md).
2. **Actions → Release → Run workflow**, pick `patch`, `minor` or `major`.

The workflow bumps `package.json`, `package-lock.json` and the manifest
(`version` + `docker_image`), rolls the changelog, tags `vX.Y.Z`, builds the
`linux/amd64` + `linux/arm64` image to `ghcr.io/prohand/gladys-acinfinity`
(`:X.Y.Z` and `:latest`), publishes the GitHub Release and runs the store
checks. Never edit the versions by hand.

For the store, the repository needs the GitHub topic
`gladys-assistant-integration`, and the ghcr.io package must be public.

## License

Apache-2.0
