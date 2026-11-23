# AC Infinity

Pilotez vos contrôleurs [AC Infinity](https://acinfinity.com) UIS depuis
Gladys : ventilateurs, extracteurs, lampes de culture, humidificateurs…
Suivez la température, l'humidité et le VPD de votre tente ou de votre pièce.

## Ce que vous obtenez

Une fois configurée, l'onglet **Découverte** liste :

| Élément AC Infinity                             | Dans Gladys                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| Contrôleur (69 Pro, 69 Pro+, AI+, Outlet AI…)   | **Température**, **Humidité**, **VPD**                                      |
| Port du contrôleur (ventilateur, lampe…)        | **Marche** (allumé / éteint), **Vitesse** (niveau 0 à 10), **Mode** (liste) |
| Capteur branché sur un contrôleur AI (port USB) | Selon le capteur : température, humidité, VPD, CO2, lumière, sol, eau, pH…  |

Chaque appareil affiche un badge **cloud** : AC Infinity ne se pilote que par
son cloud. Le badge passe à **injoignable** quand le cloud ne répond pas, ou
quand un contrôleur ou un port ne donne plus de nouvelles.

Les modes d'un port sont ceux de l'application AC Infinity : **Off**, **On**,
**Auto**, **Minuterie vers On**, **Minuterie vers Off**, **Cycle**,
**Programme**, **VPD**, plus les modes liés à un capteur sur les contrôleurs
AI (CO2, humidité du sol, température de l'eau, pH, EC, détection d'eau).

## Avant de commencer

- Le contrôleur doit être connecté en **Wi-Fi** dans l'application
  AC Infinity (un contrôleur seulement en Bluetooth n'est pas visible du
  cloud).
- Gardez l'**e-mail** et le **mot de passe** de votre compte AC Infinity.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Saisissez l'**E-mail** et le **Mot de passe** de votre compte AC Infinity.
3. Modifiez si besoin l'**Intervalle de rafraîchissement** : l'intégration
   lit votre compte toutes les minutes par défaut (30 secondes minimum).
4. Enregistrez, puis cliquez sur **Tester la connexion** : la réponse liste
   les contrôleurs, ports et capteurs trouvés.
5. Ouvrez l'onglet **Découverte** et ajoutez les appareils voulus.

## Bon à savoir

- **Marche** lit si le port alimente son appareil en ce moment. L'allumer
  passe le port en mode **On**, l'éteindre en mode **Off**.
- **Vitesse** lit le niveau actuel du port (0 à 10). Régler une vitesse passe
  le port en mode **On** à ce niveau ; 0 le passe en **Off**.
- En mode **Auto**, **Cycle**, **Programme** ou **VPD**, c'est le contrôleur
  qui décide : réglez ces modes (seuils, horaires, durées) dans l'application
  AC Infinity. Gladys change seulement le mode, pas ses réglages.
- Un changement fait dans l'application arrive dans Gladys au prochain
  rafraîchissement.
- Les mesures EC et TDS de la sonde hydro ne sont pas encore publiées : Gladys
  n'a pas encore d'unité pour elles.

## Scènes

L'intégration ajoute ses propres cartes à l'éditeur de scènes, dans la
catégorie **Intégrations**.

Déclencheurs :

- **Port AC Infinity allumé ou éteint** — un port a commencé ou cessé
  d'alimenter son appareil (mode Auto, programme, minuterie, application ou
  Gladys… sauf un changement fait par la même scène). Choisissez
  éventuellement le port et le nouvel état. Variables :
  `{{triggerEvent.data.state}}` (`on` ou `off`),
  `{{triggerEvent.data.device_name}}` et `{{triggerEvent.data.speed}}`.
- **Contrôleur AC Infinity en ligne ou hors ligne** — un contrôleur a cessé
  de répondre au cloud (coupure de courant, Wi-Fi), ou est revenu. Variables :
  `{{triggerEvent.data.status}}` (`offline` ou `online`) et
  `{{triggerEvent.data.device_name}}`.
- **Capteur d'eau AC Infinity** — le capteur d'eau d'un contrôleur AI a
  détecté de l'eau, ou est de nouveau sec. Variables :
  `{{triggerEvent.data.status}}` (`detected` ou `cleared`) et
  `{{triggerEvent.data.device_name}}`.

Actions :

- **Changer le mode d'un port AC Infinity** — Off, On, Auto, Minuterie,
  Cycle, Programme ou VPD. Renvoie le mode et le niveau du port.
- **Régler le niveau d'un port AC Infinity** — de 1 à 10, en mode On ; 0 le
  passe en Off. Renvoie le mode et le niveau du port.

## Tableau de bord

Ajoutez le widget **Vue d'ensemble AC Infinity** à un tableau de bord. Il
affiche la température, l'humidité et le VPD du contrôleur, le nombre de ports
allumés, puis une ligne par port (allumé ou éteint, niveau, mode). Le bouton
**Piloter un port** ouvre un petit formulaire : choisissez le port, le mode et,
pour le mode On, le niveau. Le bouton **Rafraîchir** relit le compte tout de
suite.

Dans les réglages du widget, choisissez un **Contrôleur** pour n'afficher que
lui. Vide, le widget affiche tous les contrôleurs (les tuiles montrent alors
le premier).

## Dépannage

- **« AC Infinity a refusé l'e-mail ou le mot de passe »** — vérifiez-les en
  vous connectant à l'application AC Infinity. Un mot de passe de plus de 25
  caractères est coupé, comme le fait l'application.
- **« Le cloud AC Infinity ne répond pas »** — AC Infinity ou votre connexion
  Internet est en panne. L'intégration réessaie à chaque rafraîchissement.
- **Un contrôleur reste injoignable** — vérifiez son Wi-Fi dans l'application
  AC Infinity.
- Plus de détails dans les logs de l'intégration (interface Gladys, ou
  `docker logs` sur l'hôte), avec `LOG_LEVEL=debug`.
