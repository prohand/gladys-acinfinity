# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- First version of the AC Infinity integration, built from the official Gladys
  integration template (SDK 0.16, Gladys 5.3 or later).
- AC Infinity cloud API client: login with the e-mail and password of the
  AC Infinity app, one login shared by parallel requests and renewed when the
  cloud refuses the token, 20-digit controller ids kept exact.
- One Gladys device per controller, port and plug-in sensor:
  - controller (69 Pro, 69 Pro+, AI+, Outlet AI…): temperature, humidity, VPD;
  - port: power on/off, level 0–10, mode (Off, On, Auto, Timer, Cycle,
    Schedule, VPD, and the sensor modes of the AI controllers);
  - plug-in sensor of an AI controller: probe (temperature, humidity, VPD),
    CO2 + light, soil moisture, water detection, pH and water temperature.
- Refresh loop (1 minute by default, 30 seconds minimum): one request for the
  whole account, only the changed values are sent to Gladys.
- `cloud` transport badge on every device, `unreachable` when the cloud does
  not answer or a controller or port is offline.
- Scene triggers: a port turned on or off; a controller went offline or came
  back; a water sensor detected water or is dry again.
- Scene actions: set the mode of a port; set the level of a port.
- "AC Infinity overview" dashboard widget: temperature, humidity, VPD, ports
  running, a status row per port, a "Control a port" form and a Refresh
  button. A setting binds it to one controller.
- "Test the connection" button in the Configuration screen.
- Declared for the countries where AC Infinity sells its controllers.
- Texts and user documentation in English, French, German and Spanish.
- CI (Prettier, ESLint, tests on Node 22 and 24, store checks, Docker
  build), Release workflow, GitHub Releases, Dependabot.
- `SECURITY.md` and `CLAUDE.md`.

[Unreleased]: https://github.com/prohand/gladys-acinfinity/commits/main
