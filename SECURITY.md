# Security policy

## Supported versions

Only the latest release of the AC Infinity integration receives security fixes.
Update the integration from the Gladys store before reporting an issue.

| Version      | Supported |
| ------------ | --------- |
| 1.x (latest) | Yes       |
| older        | No        |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub: open the **Security** tab of
[prohand/gladys-acinfinity](https://github.com/prohand/gladys-acinfinity/security),
then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- any log line that helps (remove the AC Infinity e-mail, password, token,
  controller ids and MAC addresses first).

You should get a first answer within 7 days. A fix is released as a new version of
the integration, and the advisory is published once users can update.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (report to
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys/security)), the
AC Infinity cloud, app and controllers (report to AC Infinity).

## How the integration handles secrets

- The AC Infinity password is stored by Gladys in a `secret` field; the
  integration never logs it, nor the token the cloud gives back at login.
- The token lives in memory only, nothing is written to disk.
- The integration only talks to `https://www.acinfinityserver.com`, over HTTPS,
  the server the AC Infinity app itself uses.
- AC Infinity offers no restricted API key: the integration logs in like the
  app, with the full rights of the account. It only reads the controllers and
  changes the mode and level of their ports; it never changes the account,
  the Auto thresholds, timers or schedules.

## Good practices for users

- When the AC Infinity app lets you share your controllers with a second
  account, give the integration that account: your main password then stays
  out of Gladys.
- Change the password in the AC Infinity app if it leaks, then enter the new
  one in the integration.
- Keep Gladys and the integration up to date.
