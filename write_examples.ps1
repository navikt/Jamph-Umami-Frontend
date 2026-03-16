$f = "c:\Users\PerEr\Documents\Github\jamph-sql-ki-assistent\Jamph-Umami-Frontend\src\pages\analysis\prototype4Examples.ts"
$content = @'
// Isolated copy of eksempelspørringer for Prototype 4.
// Original source: src/components/analysis/AiByggerPanel.tsx (examplesAiBuilder)
// These are pre-populated as "previous chats" in the sidebar.

export type Prototype4Example = {
    id: string;
    userMessage: string;
    botReply: string;
    title: string;
    sql: string;
    tabOrder: string[];
    explanation?: string;
    apiOnly?: boolean;
};

export function getPrototype4Examples(
    websiteId: string,
    path: string,
    pathLabel: string,
    pathConditionSQL: string,
    buildRegressionSQLInline: () => string,
): Prototype4Example[] {
    return [
        {
            id: 'daglige-sidevisninger',
            userMessage: `Kan du vise daglige sidevisninger i 2025 for https://aksel.nav.no/?`,
            botReply: `Ja! Her er daglige sidevisninger for aksel.nav.no i 2025.`,
            title: `Daglige sidevisninger for ${pathLabel} i 2025`,
            sql: `SELECT\n  FORMAT_TIMESTAMP('%Y-%m-%d', created_at) AS dato,\n  COUNT(*) AS sidevisninger\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\nGROUP BY dato\nORDER BY dato ASC;`,
            tabOrder: ['linechart', 'areachart', 'barchart', 'table', 'piechart', 'stegvisning', 'kiforklaring'],
            explanation: `Gjennomsnittet ligger på rundt 165 sidevisninger per dag, men med et tydelig fall i helger. De mest besøkte dagene er mandag og tirsdag, noe som bekrefter at dette er et arbeidsverktøy brukt primært i arbeidstiden. En markant topp mot slutten av september kan tyde på en lansering eller større oppdatering i designsystemet som skapte ekstra oppmerksomhet.`,
        },
        {
            id: 'topp-sider',
            userMessage: `Hvilke sider er mest besøkt på https://aksel.nav.no/komponenter/core i 2025?`,
            botReply: `Her er topp 12 mest besøkte undersider under /komponenter/core i 2025.`,
            title: `Topp 12 sider under ${path}`,
            sql: `SELECT\n  url_path AS side,\n  COUNT(*) AS sidevisninger\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\nGROUP BY side\nORDER BY sidevisninger DESC\nLIMIT 12;`,
            tabOrder: ['barchart', 'table', 'piechart', 'linechart', 'areachart', 'stegvisning', 'kiforklaring'],
            explanation: `Komponent-sidene dominerer klart, og Button er den mest besøkte enkelt-siden - et naturlig startpunkt for utviklere som utforsker designsystemet for første gang. /god-praksis og /komponenter utgjør til sammen 7 av topp-10. En overraskende lav trafikk under /mønstre tatt i betraktning innholdets relevans kan tyde på at seksjonen er vanskelig å oppdage.`,
        },
        {
            id: 'per-maaned',
            userMessage: `Kan du vise sidevisninger per måned for https://aksel.nav.no/designsystemet?`,
            botReply: `Selvfølgelig! Her er sidevisningene per måned for /designsystemet i 2025.`,
            title: `Sidevisninger per måned - ${pathLabel}`,
            sql: `SELECT\n  EXTRACT(MONTH FROM created_at) AS maaned,\n  COUNT(*) AS sidevisninger\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\nGROUP BY maaned\nORDER BY maaned ASC;`,
            tabOrder: ['areachart', 'linechart', 'barchart', 'table', 'piechart', 'stegvisning', 'kiforklaring'],
            explanation: `Januar og februar er klart sterkest, noe som gjenspeiler oppstart av nye prosjekter etter nyttår. Sommermånedene juni–august viser et fall på rundt 35–40 %, typisk for et verktøy brukt primært i arbeidstiden. Høsten viser en fin oppgang igjen, men når aldri januar-nivå fullt ut.`,
        },
        {
            id: 'sideflyt',
            userMessage: `Hvordan beveger brukerne seg rundt på https://aksel.nav.no/komponenter/core?`,
            botReply: `Her er en visualisering av sideflyt fra /komponenter/core.`,
            title: `Sideflyt fra ${path}`,
            sql: '',
            tabOrder: ['stegvisning'],
            apiOnly: true,
        },
        {
            id: 'trafikkilder',
            userMessage: `Hvor kommer trafikken til https://aksel.nav.no/ fra i november 2025?`,
            botReply: `Her er en oversikt over trafikkilder til aksel.nav.no i november 2025.`,
            title: `Trafikkilder - ${pathLabel}`,
            sql: `SELECT\n  COALESCE(NULLIF(referrer_domain, ''), '(direkte)') AS kilde,\n  COUNT(*) AS sidevisninger\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\n  AND EXTRACT(MONTH FROM created_at) = 11\nGROUP BY kilde\nORDER BY sidevisninger DESC\nLIMIT 15;`,
            tabOrder: ['barchart', 'piechart', 'table', 'linechart', 'areachart', 'stegvisning', 'kiforklaring'],
            explanation: `Nesten halvparten av trafikken i november kom direkte. Google stod for rundt 31 %, mens intern trafikk fra nav.no bidro med 12 %. Sosiale medier og nyhetsbrev utgjorde tilnærmet null.`,
        },
        {
            id: 'innkommende-linker',
            userMessage: `Hvilke eksterne nettsider sender besøkende til https://aksel.nav.no/designsystemet?`,
            botReply: `Her er inngående trafikkilder til /designsystemet.`,
            title: `Inngående trafikkilder - ${pathLabel}`,
            sql: `SELECT\n  COALESCE(NULLIF(referrer_domain, ''), '(direkte)') AS kilde,\n  COUNT(DISTINCT session_id) AS unike_besokende\nFROM \`fagtorsdag-prod-81a6.umami_student.event\`\nWHERE\n  event_type = 1\n  AND website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM created_at) = 2025\nGROUP BY kilde\nORDER BY unike_besokende DESC\nLIMIT 1000;`,
            tabOrder: ['barchart', 'piechart', 'table', 'linechart', 'areachart', 'stegvisning', 'kiforklaring'],
            explanation: `De aller fleste innkommende lenkene kommer fra interne NAV-systemer og GitHub. google.com og github.com er de to klart største eksterne kildene. Sporadisk trafikk fra dev.to og stackoverflow antyder at internasjonale fagmiljøer også har funnet veien hit.`,
        },
        {
            id: 'regresjon',
            userMessage: `Er det en nedgang i daglige sidevisninger på https://aksel.nav.no/ i 2025?`,
            botReply: `Her er en regresjonsanalyse av trenden i daglige sidevisninger for aksel.nav.no.`,
            title: `Regresjon: daglige sidevisninger - ${pathLabel}`,
            sql: buildRegressionSQLInline(),
            tabOrder: ['kiforklaring', 'table', 'linechart', 'areachart', 'barchart', 'piechart', 'stegvisning'],
            explanation: `Et stigningstall på –0.83 tyder på at antall daglige sidevisninger avtar med nesten én visning per dag gjennom 2025. R² på 0.18 betyr at modellen forklarer rundt 18 % av variasjonen. Retningen er klar, men datagrunnlaget er for støyete til å trekke sterke konklusjoner om fremtidig utvikling.`,
        },
        {
            id: 'nokkeltal',
            userMessage: `Kan du gi meg nøkkeltall for https://aksel.nav.no/komponenter/core?`,
            botReply: `Her er nøkkeltall for handlinger, navigering og frafall på /komponenter/core i 2025.`,
            title: `Nøkkeltall - ${pathLabel}`,
            sql: `WITH sessions AS (\n  SELECT\n    session_id,\n    COUNT(*) AS page_count,\n    COUNTIF(event_type = 2) AS event_count\n  FROM \`fagtorsdag-prod-81a6.umami_student.event\`\n  WHERE\n    event_type IN (1, 2)\n    AND website_id = '${websiteId}'\n    ${pathConditionSQL}\n    AND EXTRACT(YEAR FROM created_at) = 2025\n  GROUP BY session_id\n)\nSELECT 'Unike besøkende' AS kategori, COUNT(*) AS sesjoner FROM sessions\nUNION ALL\nSELECT 'Utførte handlinger', COUNTIF(event_count > 0) FROM sessions\nUNION ALL\nSELECT 'Navigering uten handling', COUNTIF(event_count = 0 AND page_count > 1) FROM sessions\nUNION ALL\nSELECT 'Forlot nettstedet', COUNTIF(page_count = 1 AND event_count = 0) FROM sessions;`,
            tabOrder: ['statcards', 'table', 'barchart', 'piechart', 'linechart', 'areachart', 'stegvisning', 'kiforklaring'],
            explanation: `Av de besøkende i 2025 utførte nesten to tredeler minst én aktiv handling. At rundt én av tre navigerte videre uten å klikke på noe er normalt for dokumentasjon. Kun et mindretall forlot siden uten noen form for videre engasjement.`,
        },
        {
            id: 'operativsystem',
            userMessage: `Hvilket operativsystem bruker besøkende på https://aksel.nav.no/?`,
            botReply: `Her er fordelingen av operativsystemer blant besøkende på aksel.nav.no i 2025.`,
            title: `Operativsystem - ${pathLabel}`,
            sql: `SELECT\n  COALESCE(NULLIF(s.os, ''), '(ukjent)') AS operativsystem,\n  COUNT(DISTINCT e.session_id) AS unike_besokende\nFROM \`fagtorsdag-prod-81a6.umami_student.event\` e\nLEFT JOIN \`fagtorsdag-prod-81a6.umami_student.session\` s\n  ON e.session_id = s.session_id\nWHERE\n  e.event_type = 1\n  AND e.website_id = '${websiteId}'\n  ${pathConditionSQL}\n  AND EXTRACT(YEAR FROM e.created_at) = 2025\nGROUP BY operativsystem\nORDER BY unike_besokende DESC\nLIMIT 12;`,
            tabOrder: ['piechart', 'barchart', 'table', 'areachart', 'linechart', 'stegvisning', 'kiforklaring'],
            explanation: `Mac dominerer med over 58 % - ikke overraskende for en brukergruppe som i stor grad består av designere og frontend-utviklere. Windows 10 er nest størst, mens iOS og Android til sammen utgjør under 16 %.`,
        },
        {
            id: 'etter-sok',
            userMessage: `Hvor går brukere etter å ha søkt på https://aksel.nav.no/designsystemet?`,
            botReply: `Her er de vanligste sidene brukere lander på etter søk på /designsystemet.`,
            title: `Navigering etter søk - ${pathLabel}`,
            sql: `WITH sok_events AS (\n  SELECT session_id, created_at AS sok_tid\n  FROM \`fagtorsdag-prod-81a6.umami_student.event\`\n  WHERE event_type = 2\n    AND event_name = 'sok'\n    AND website_id = '${websiteId}'\n    ${pathConditionSQL}\n    AND EXTRACT(YEAR FROM created_at) = 2025\n),\nneste_sider AS (\n  SELECT\n    s.session_id,\n    e.url_path AS side,\n    ROW_NUMBER() OVER (PARTITION BY s.session_id, s.sok_tid ORDER BY e.created_at ASC) AS rn\n  FROM sok_events s\n  JOIN \`fagtorsdag-prod-81a6.umami_student.event\` e\n    ON s.session_id = e.session_id\n    AND e.event_type = 1\n    AND e.created_at > s.sok_tid\n    AND e.website_id = '${websiteId}'\n    AND EXTRACT(YEAR FROM e.created_at) = 2025\n)\nSELECT\n  side AS neste_side,\n  COUNT(*) AS antall_sok\nFROM neste_sider\nWHERE rn = 1\nGROUP BY side\nORDER BY antall_sok DESC\nLIMIT 25;`,
            tabOrder: ['table', 'barchart', 'piechart', 'linechart', 'areachart', 'stegvisning', 'kiforklaring'],
            explanation: `Etter søk ender nesten halvparten av brukerne opp på en komponent-side, med Button og Input som klare favoritter. Rundt 20 % navigerer til god-praksis-seksjonen. Andelen som endte tilbake på forsiden var svært lav.`,
        },
    ];
}
'@
[System.IO.File]::WriteAllText($f, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done"
