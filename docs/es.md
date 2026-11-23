# AC Infinity

Controle sus controladores [AC Infinity](https://acinfinity.com) UIS desde
Gladys: ventiladores en línea, extractores, luces de cultivo,
humidificadores… Siga la temperatura, la humedad y el VPD de su armario de
cultivo o de su habitación.

## Lo que obtiene

Una vez configurada, la pestaña **Descubrimiento** muestra:

| Elemento AC Infinity                                | En Gladys                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| Controlador (69 Pro, 69 Pro+, AI+, Outlet AI…)      | **Temperatura**, **Humedad**, **VPD**                                   |
| Puerto del controlador (ventilador, luz…)           | **Encendido** (sí / no), **Velocidad** (nivel 0 a 10), **Modo** (lista) |
| Sensor conectado a un controlador AI (puerto USB-C) | Según el sensor: temperatura, humedad, VPD, CO2, luz, suelo, agua…      |

Cada dispositivo muestra una insignia **nube**: AC Infinity solo se controla
a través de su nube. La insignia pasa a **inaccesible** cuando la nube no
responde, o cuando un controlador o un puerto deja de informar.

Los modos de un puerto son los de la app AC Infinity: **Off**, **On**,
**Auto**, **Temporizador a On**, **Temporizador a Off**, **Ciclo**,
**Horario**, **VPD**, más los modos ligados a un sensor de los controladores
AI (CO2, humedad del suelo, temperatura del agua, pH, EC, detección de agua).

## Antes de empezar

- El controlador debe estar en **Wi-Fi** en la app AC Infinity (un
  controlador solo en Bluetooth no es visible desde la nube).
- Tenga a mano el **correo** y la **contraseña** de su cuenta AC Infinity.

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. Introduzca el **Correo electrónico** y la **Contraseña** de su cuenta
   AC Infinity.
3. Cambie si hace falta el **Intervalo de actualización**: la integración lee
   su cuenta cada minuto por defecto (30 segundos como mínimo).
4. Guarde y pulse **Probar la conexión**: la respuesta indica los
   controladores, puertos y sensores encontrados.
5. Abra la pestaña **Descubrimiento** y añada los dispositivos que quiera.

## Conviene saber

- **Encendido** indica si el puerto alimenta su aparato en este momento.
  Encenderlo pone el puerto en modo **On**, apagarlo en modo **Off**.
- **Velocidad** indica el nivel actual del puerto (0 a 10). Ajustar una
  velocidad pone el puerto en modo **On** a ese nivel; 0 lo pone en **Off**.
- En modo **Auto**, **Ciclo**, **Horario** o **VPD**, decide el controlador:
  configure esos modos (umbrales, horas, duraciones) en la app AC Infinity.
  Gladys solo cambia el modo, no sus ajustes.
- Un cambio hecho en la app llega a Gladys en la siguiente actualización.
- Las medidas EC y TDS del sensor hidro aún no se publican: Gladys todavía no
  tiene unidad para ellas.

## Escenas

La integración añade sus propias tarjetas al editor de escenas, en la
categoría **Integraciones**.

Disparadores:

- **Puerto AC Infinity encendido o apagado** — un puerto empezó o dejó de
  alimentar su aparato (modo Auto, horario, temporizador, app o Gladys…
  salvo un cambio hecho por la misma escena). Elija opcionalmente el puerto y
  el nuevo estado. Variables: `{{triggerEvent.data.state}}` (`on` u `off`),
  `{{triggerEvent.data.device_name}}` y `{{triggerEvent.data.speed}}`.
- **Controlador AC Infinity en línea o sin conexión** — un controlador dejó
  de responder a la nube (corte de luz, Wi-Fi), o ha vuelto. Variables:
  `{{triggerEvent.data.status}}` (`offline` u `online`) y
  `{{triggerEvent.data.device_name}}`.
- **Sensor de agua AC Infinity** — el sensor de agua de un controlador AI
  detectó agua, o vuelve a estar seco. Variables:
  `{{triggerEvent.data.status}}` (`detected` o `cleared`) y
  `{{triggerEvent.data.device_name}}`.

Acciones:

- **Cambiar el modo de un puerto AC Infinity** — Off, On, Auto,
  Temporizador, Ciclo, Horario o VPD. Devuelve el modo y el nivel del puerto.
- **Ajustar el nivel de un puerto AC Infinity** — de 1 a 10, en modo On; 0 lo
  pone en Off. Devuelve el modo y el nivel del puerto.

## Panel

Añada el widget **Resumen de AC Infinity** a un panel. Muestra la
temperatura, la humedad y el VPD del controlador, el número de puertos
encendidos y luego una fila por puerto (encendido o apagado, nivel, modo). El
botón **Controlar un puerto** abre un pequeño formulario: elija el puerto, el
modo y, para el modo On, el nivel. El botón **Actualizar** vuelve a leer la
cuenta al instante.

En los ajustes del widget, elija un **Controlador** para mostrar solo ese.
Vacío, el widget muestra todos los controladores (los mosaicos muestran
entonces el primero).

## Solución de problemas

- **«AC Infinity rechazó el correo o la contraseña»** — compruébelos
  iniciando sesión en la app AC Infinity. Una contraseña de más de 25
  caracteres se corta, como hace la app.
- **«La nube de AC Infinity no responde»** — AC Infinity o su conexión a
  Internet está caída. La integración lo reintenta en cada actualización.
- **Un controlador sigue inaccesible** — compruebe su Wi-Fi en la app
  AC Infinity.
- Más detalles en los registros de la integración (interfaz de Gladys, o
  `docker logs` en el host), con `LOG_LEVEL=debug`.
