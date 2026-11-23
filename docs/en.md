# AC Infinity

Control your [AC Infinity](https://acinfinity.com) UIS controllers from
Gladys: inline fans, exhaust fans, grow lights, humidifiers… Follow the
temperature, humidity and VPD of your grow tent or room.

## What you get

Once configured, the **Discovery** tab lists:

| AC Infinity item                                  | In Gladys                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Controller (69 Pro, 69 Pro+, AI+, Outlet AI…)     | **Temperature**, **Humidity**, **VPD**                                        |
| Controller port (fan, light…)                     | **Power** (on / off), **Speed** (level 0 to 10), **Mode** (list)              |
| Sensor plugged into an AI controller (USB-C port) | Depending on the sensor: temperature, humidity, VPD, CO2, light, soil, water… |

Every device shows a **cloud** badge: AC Infinity is only reachable through
its cloud. The badge turns **unreachable** when the cloud does not answer, or
when a controller or port stops reporting.

The modes of a port are those of the AC Infinity app: **Off**, **On**,
**Auto**, **Timer to On**, **Timer to Off**, **Cycle**, **Schedule**,
**VPD**, plus the sensor-driven modes of the AI controllers (CO2, soil
moisture, water temperature, pH, EC, water detection).

## Before you start

- The controller must be on **Wi-Fi** in the AC Infinity app (a controller
  on Bluetooth only is not visible from the cloud).
- Have the **e-mail** and **password** of your AC Infinity account at hand.

## Configuration

1. Open the **Configuration** tab of the integration.
2. Enter the **E-mail** and **Password** of your AC Infinity account.
3. Change the **Refresh interval** if needed: the integration reads your
   account every minute by default (30 seconds minimum).
4. Save, then press **Test the connection**: the answer lists the
   controllers, ports and sensors found.
5. Open the **Discovery** tab and add the devices you want.

## Good to know

- **Power** reads whether the port powers its device right now. Turning it on
  sets the port to the **On** mode, turning it off to the **Off** mode.
- **Speed** reads the current level of the port (0 to 10). Setting a speed
  sets the port to the **On** mode at that level; 0 sets it to **Off**.
- In **Auto**, **Cycle**, **Schedule** or **VPD** mode, the controller
  decides: set these modes up (thresholds, times, durations) in the
  AC Infinity app. Gladys only changes the mode, not its settings.
- A change made in the app reaches Gladys at the next refresh.
- The EC and TDS readings of the hydro sensor are not published yet: Gladys
  has no unit for them.

## Scenes

The integration adds its own cards to the scene editor, in the
**Integrations** category.

Triggers:

- **AC Infinity port turned on or off** — a port started or stopped powering
  its device (Auto mode, schedule, timer, app or Gladys… except a change made
  by the same scene). Optionally pick the port and the new state. Variables:
  `{{triggerEvent.data.state}}` (`on` or `off`),
  `{{triggerEvent.data.device_name}}` and `{{triggerEvent.data.speed}}`.
- **AC Infinity controller online or offline** — a controller stopped
  reporting to the cloud (power cut, Wi-Fi), or came back. Variables:
  `{{triggerEvent.data.status}}` (`offline` or `online`) and
  `{{triggerEvent.data.device_name}}`.
- **AC Infinity water sensor** — the water sensor of an AI controller
  detected water, or is dry again. Variables: `{{triggerEvent.data.status}}`
  (`detected` or `cleared`) and `{{triggerEvent.data.device_name}}`.

Actions:

- **Set an AC Infinity port mode** — Off, On, Auto, Timer, Cycle, Schedule
  or VPD. Returns the mode and level of the port.
- **Set an AC Infinity port level** — from 1 to 10, in On mode; 0 sets it to
  Off. Returns the mode and level of the port.

## Dashboard

Add the **AC Infinity overview** widget to a dashboard. It shows the
temperature, humidity and VPD of the controller, the number of ports running,
then one row per port (on or off, level, mode). The **Control a port** button
opens a short form: pick the port, the mode and, for the On mode, the level.
The **Refresh** button reads the account again at once.

In the widget settings, pick a **Controller** to show only that one. Empty,
the widget shows every controller (the tiles then show the first one).

## Troubleshooting

- **"AC Infinity refused the e-mail or password"** — check them by logging
  into the AC Infinity app. A password longer than 25 characters is cut, like
  the app does.
- **"The AC Infinity cloud does not answer"** — AC Infinity or your Internet
  connection is down. The integration retries at every refresh.
- **A controller stays unreachable** — check its Wi-Fi in the AC Infinity app.
- More details in the integration logs (Gladys interface, or `docker logs` on
  the host), with `LOG_LEVEL=debug`.
