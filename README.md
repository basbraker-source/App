# Bruiloftsplanner

Een web-app waarmee bruidsparen hun bruiloft plannen. Alles staat op één plek:

- **Overzicht** met aftellen naar de grote dag en de voortgang van alles
- **Checklist** met 43 standaardtaken, ingedeeld per periode (12+ maanden vooraf tot na de bruiloft). Je kunt taken toevoegen, afvinken en filteren
- **Budget** per post (begroot, werkelijk, betaald). Het totaalbudget wordt automatisch verdeeld over de standaardposten
- **Gastenlijst** met dag- en avondgasten, reacties (RSVP) en dieetwensen
- **Leveranciers** met contactgegevens en status (oriënteren, offerte, geboekt, betaald)
- **Back-up** downloaden en terugzetten, afdrukken en alles wissen

Alle gegevens blijven in de browser van de bezoeker (`localStorage`). Er is geen server, database of account nodig, en de gegevens van bruidsparen komen niet bij jou terecht.

## Op je website zetten

De app bestaat uit drie bestanden: `index.html`, `styles.css` en `app.js`.

**Optie 1: als eigen pagina.** Upload de drie bestanden naar een map op je webserver, bijvoorbeeld `/planner/`. De app staat dan op `https://jouwsite.nl/planner/`.

**Optie 2: in een bestaande pagina (WordPress, Wix, Squarespace, enz.).** Upload de bestanden zoals bij optie 1 en voeg op je pagina een HTML-blok toe met:

```html
<iframe src="https://jouwsite.nl/planner/" title="Bruiloftsplanner"
        style="width:100%; height:1400px; border:0;" loading="lazy"></iframe>
```

**Optie 3: gratis hosting via GitHub Pages.** Ga in deze repository naar *Settings → Pages* en kies de branch met deze bestanden. Gebruik daarna de link van GitHub Pages in de iframe van optie 2.

## Aanpassen

- **Kleuren:** wijzig de variabelen bovenaan `styles.css` (`--accent`, `--bg`, enz.)
- **Standaardtaken en budgetposten:** wijzig `DEFAULT_TASKS` en `DEFAULT_BUDGET` bovenaan `app.js`
- **Lettertypen:** worden geladen via Google Fonts in `index.html`
