### GitHub-token (NODE_AUTH_TOKEN)
Prosjektet bruker `@navikt`-pakker fra GitHub Packages, som krever autentisering. Opprett et [Personal Access Token (classic)](https://github.com/settings/tokens) med kun `read:packages`-tilgang, og sett det som en permanent miljøvariabel:

**Windows:**
```powershell
[System.Environment]::SetEnvironmentVariable("NODE_AUTH_TOKEN", "ghp_dittTokenHer", "User")
```

**macOS / Linux** — legg til i `~/.zshrc` (macOS) eller `~/.bashrc` (Linux):
```bash
export NODE_AUTH_TOKEN=ghp_dittTokenHer
```
Kjør så `source ~/.zshrc` (eller `source ~/.bashrc`) for at det skal gjelde med én gang.

**Begge**
Restart vs code etterpå for å sikre at tokenet er tilgjengelig i alle terminaler og prosesser.