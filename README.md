# Bruiloftsplanner

Een web-app waarmee bruidsparen hun bruiloft plannen, in de stijl van brakermedia.nl.

- **Overzicht:** aftellen naar de grote dag en de voortgang van alles
- **Checklist:** 43 standaardtaken, ingedeeld per periode
- **Budget:** per post begroot, werkelijk en betaald, met automatische verdeling van het totaalbudget
- **Gasten:** dag- en avondgasten, reacties (RSVP) en dieetwensen
- **Tafels:** tafelschikking met een keuzemenu of door te slepen, met een teller voor vrije stoelen
- **Draaiboek:** het programma van de dag op tijd gesorteerd, met een voorbeeldprogramma
- **Leveranciers:** contactgegevens en status
- **Samen plannen:** beide partners op hun eigen apparaat, via een koppelcode
- **Back-up:** downloaden en terugzetten, afdrukken en alles wissen

## Bestanden

| Bestand | Wat het doet |
|---|---|
| `index.html`, `styles.css`, `app.js` | De app zelf |
| `sync.php` | Server-script voor samen plannen (PHP 7.4 of hoger, standaard bij Strato) |

## Op de website zetten (Strato + FileZilla)

1. Upload de map `planner` met alle vier de bestanden naar de hoofdmap van brakermedia.nl.
2. Open `https://brakermedia.nl/planner/`.
3. Bij het eerste gebruik van samen plannen maakt `sync.php` zelf de map `planner/data` aan en schermt die af met een `.htaccess`-bestand.

Controleer na het uploaden dat `https://brakermedia.nl/planner/data/` een foutmelding geeft (403 Forbidden). Dan zijn de gegevens niet van buitenaf te openen.

## Samen plannen: hoe het werkt

- **Koppelcode:** partner 1 maakt in Instellingen een koppelcode, en partner 2 vult die in op het eigen apparaat.
- **Opslag:** de planning wordt als JSON-bestand in `planner/data/` bewaard. De bestandsnaam is een hash van de code, zodat de code zelf nergens op de server staat.
- **Synchroniseren:** wijzigingen gaan automatisch heen en weer (elke 15 seconden en bij het openen van de app). Als beide partners tegelijk iets wijzigen, worden de wijzigingen per onderdeel samengevoegd.
- **Bewaartermijn:** na 18 maanden zonder wijzigingen wordt een planning automatisch verwijderd. Een bruidspaar kan de planning ook zelf van de server verwijderen.
- **Bescherming tegen misbruik:** per IP-adres zijn maximaal 20 nieuwe codes en 30 onjuiste codes per uur toegestaan.

### Privacy (AVG)

Bij samen plannen bewaar jij als Braker Media persoonsgegevens van bruidsparen en hun gasten, zoals namen en dieetwensen. Zet daarom iets als dit in je privacyverklaring:

> **Bruiloftsplanner.** Als je in de bruiloftsplanner 'Samen plannen' gebruikt, bewaren wij jullie planning (zoals namen, gastenlijst en budget) op onze server, zodat jullie die op meerdere apparaten kunnen gebruiken. Alleen wie de koppelcode heeft, kan de planning openen. Wij gebruiken deze gegevens nergens anders voor. De planning wordt automatisch verwijderd na 18 maanden zonder wijzigingen, en je kunt hem op elk moment zelf verwijderen via Instellingen → Samen plannen → Verwijderen van server. Gebruik je 'Samen plannen' niet, dan blijft alles alleen in je eigen browser.

## Aanpassen

- **Kleuren:** wijzig de variabelen bovenaan `styles.css`
- **Standaardtaken, budgetposten en voorbeeldprogramma:** wijzig `DEFAULT_TASKS`, `DEFAULT_BUDGET` en `SCHEDULE_TEMPLATE` bovenaan `app.js`
- **Bewaartermijn en limieten:** wijzig de constanten bovenaan `sync.php`
