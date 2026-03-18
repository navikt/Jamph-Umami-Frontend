Innblikk med KI
================

For å måle brukeradferd effektivt, trenger du verktøy som gir innsikt uten å gå på bekostning av brukervennlighet, datasikkerhet eller personvern..

Derfor tilbyr Team ResearchOps Umami – en løsning som kombinerer ferdigbygde dashboards, med mulighet for dypere produktanalyser i verktøy som Metabase, Grafana og Jupyter Notebook.

---

# Bruk a KI

Start Umami er utviklet med hjelp av KI.

# Henvendelser og veiledning

Spørsmål knyttet til koden eller arbeidet kan stilles
som issues her på Github. Henvendelser kan sendes via Slack i
kanalen [#researchops](https://nav-it.slack.com/archives/C02UGFS2J4B).


# Frontend Installation Instructions

## Jamph-Umami-Frontend (Our version of Start-Umami-Student edition)
   git clone https://github.com/PerErikGronvik/Jamph-Umami-Frontend Jamph-Umami-Frontend
   - Paste the file `fagtorsdag-prod-81a6-52ac69097f46.json` into the `Jamph-Umami-Frontend` folder. Keep the file secret, do not share it.

**Install and start**:
   Jamph-Umami-Frontend
   # If pnpm is not on PATH, use Corepack
   corepack prepare pnpm@9.12.2 --activate
   corepack pnpm install (If first time)
   corepack pnpm start
   Click the link to continue

   

   ### macOS / Linux
   ```bash
   # If pnpm is not on PATH, use Corepack
   corepack prepare pnpm@9.12.2 --activate
   pnpm install        # first time only
   pnpm start
   ```

   ### Windows
   > **OBS:** `corepack enable` krever admin-rettigheter på Windows og feiler uten det. Kan åpne powershell som admin eller bruke npm til å  installere pnpm.
   > Installer pnpm via npm i stedet – det fungerer uten admin.
   ```powershell
   npm install -g pnpm   # én gang, krever ikke admin
   pnpm install          # første gang
   pnpm start
   ```
   Click the link to continue

   Note: To restart the server, press `Ctrl/command+C` to stop it, then run `pnpm start` again.