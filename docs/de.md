# AC Infinity

Steuere deine [AC-Infinity](https://acinfinity.com)-UIS-Controller aus
Gladys: Rohrventilatoren, Abluftlüfter, Pflanzenlampen, Luftbefeuchter…
Verfolge Temperatur, Luftfeuchtigkeit und VPD deines Growzelts oder Raums.

## Was du bekommst

Nach der Einrichtung listet der Tab **Erkennung**:

| AC-Infinity-Element                           | In Gladys                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| Controller (69 Pro, 69 Pro+, AI+, Outlet AI…) | **Temperatur**, **Feuchtigkeit**, **VPD**                                 |
| Port des Controllers (Lüfter, Lampe…)         | **Ein/Aus**, **Geschwindigkeit** (Stufe 0 bis 10), **Modus** (Liste)      |
| Sensor an einem AI-Controller (USB-C-Port)    | Je nach Sensor: Temperatur, Feuchtigkeit, VPD, CO2, Licht, Boden, Wasser… |

Jedes Gerät zeigt ein **Cloud**-Abzeichen: AC Infinity ist nur über seine
Cloud erreichbar. Das Abzeichen wechselt auf **nicht erreichbar**, wenn die
Cloud nicht antwortet oder ein Controller oder Port sich nicht mehr meldet.

Die Modi eines Ports sind die der AC-Infinity-App: **Off**, **On**, **Auto**,
**Timer bis On**, **Timer bis Off**, **Zyklus**, **Zeitplan**, **VPD**, dazu
die sensorgesteuerten Modi der AI-Controller (CO2, Bodenfeuchte,
Wassertemperatur, pH, EC, Wassererkennung).

## Bevor du beginnst

- Der Controller muss in der AC-Infinity-App im **WLAN** sein (ein Controller
  nur mit Bluetooth ist aus der Cloud nicht sichtbar).
- Halte **E-Mail** und **Passwort** deines AC-Infinity-Kontos bereit.

## Einrichtung

1. Öffne den Tab **Konfiguration** der Integration.
2. Gib **E-Mail** und **Passwort** deines AC-Infinity-Kontos ein.
3. Passe bei Bedarf das **Aktualisierungsintervall** an: Die Integration
   liest dein Konto standardmäßig jede Minute (mindestens 30 Sekunden).
4. Speichere und klicke auf **Verbindung testen**: Die Antwort listet die
   gefundenen Controller, Ports und Sensoren.
5. Öffne den Tab **Erkennung** und füge die gewünschten Geräte hinzu.

## Gut zu wissen

- **Ein/Aus** zeigt, ob der Port sein Gerät gerade versorgt. Einschalten
  setzt den Port in den Modus **On**, Ausschalten in den Modus **Off**.
- **Geschwindigkeit** zeigt die aktuelle Stufe des Ports (0 bis 10). Eine
  Geschwindigkeit setzen schaltet den Port in den Modus **On** mit dieser
  Stufe; 0 schaltet ihn auf **Off**.
- In den Modi **Auto**, **Zyklus**, **Zeitplan** oder **VPD** entscheidet
  der Controller: Richte diese Modi (Schwellen, Zeiten, Dauern) in der
  AC-Infinity-App ein. Gladys ändert nur den Modus, nicht seine Einstellungen.
- Eine Änderung in der App kommt bei der nächsten Aktualisierung in Gladys an.
- Die EC- und TDS-Werte des Hydro-Sensors werden noch nicht veröffentlicht:
  Gladys hat noch keine Einheit dafür.

## Szenen

Die Integration fügt dem Szenen-Editor eigene Karten hinzu, in der Kategorie
**Integrationen**.

Auslöser:

- **AC-Infinity-Port ein- oder ausgeschaltet** — ein Port hat begonnen oder
  aufgehört, sein Gerät zu versorgen (Auto-Modus, Zeitplan, Timer, App oder
  Gladys… außer einer Änderung durch dieselbe Szene). Wähle optional den Port
  und den neuen Zustand. Variablen: `{{triggerEvent.data.state}}` (`on` oder
  `off`), `{{triggerEvent.data.device_name}}` und
  `{{triggerEvent.data.speed}}`.
- **AC-Infinity-Controller online oder offline** — ein Controller meldet sich
  nicht mehr bei der Cloud (Stromausfall, WLAN) oder ist zurück. Variablen:
  `{{triggerEvent.data.status}}` (`offline` oder `online`) und
  `{{triggerEvent.data.device_name}}`.
- **AC-Infinity-Wassersensor** — der Wassersensor eines AI-Controllers hat
  Wasser erkannt oder ist wieder trocken. Variablen:
  `{{triggerEvent.data.status}}` (`detected` oder `cleared`) und
  `{{triggerEvent.data.device_name}}`.

Aktionen:

- **Modus eines AC-Infinity-Ports setzen** — Off, On, Auto, Timer, Zyklus,
  Zeitplan oder VPD. Gibt Modus und Stufe des Ports zurück.
- **Stufe eines AC-Infinity-Ports setzen** — von 1 bis 10, im Modus On; 0
  schaltet ihn auf Off. Gibt Modus und Stufe des Ports zurück.

## Dashboard

Füge das Widget **AC-Infinity-Übersicht** einem Dashboard hinzu. Es zeigt
Temperatur, Feuchtigkeit und VPD des Controllers, die Zahl der laufenden
Ports und dann eine Zeile pro Port (an oder aus, Stufe, Modus). Der Button
**Port steuern** öffnet ein kurzes Formular: Wähle Port, Modus und, für den
Modus On, die Stufe. Der Button **Aktualisieren** liest das Konto sofort neu.

In den Einstellungen des Widgets wählst du einen **Controller**, um nur ihn
anzuzeigen. Leer zeigt das Widget alle Controller (die Kacheln zeigen dann den
ersten).

## Fehlerbehebung

- **„AC Infinity hat E-Mail oder Passwort abgelehnt“** — prüfe sie mit einer
  Anmeldung in der AC-Infinity-App. Ein Passwort mit mehr als 25 Zeichen wird
  gekürzt, wie es die App tut.
- **„Die AC-Infinity-Cloud antwortet nicht“** — AC Infinity oder deine
  Internetverbindung ist gestört. Die Integration versucht es bei jeder
  Aktualisierung erneut.
- **Ein Controller bleibt nicht erreichbar** — prüfe sein WLAN in der
  AC-Infinity-App.
- Mehr Details in den Logs der Integration (Gladys-Oberfläche oder
  `docker logs` auf dem Host), mit `LOG_LEVEL=debug`.
