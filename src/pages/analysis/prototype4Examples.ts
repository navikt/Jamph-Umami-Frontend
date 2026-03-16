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

/** Static mock result rows for each example, keyed by example id. */
export const EXAMPLE_MOCK_DATA: Record<string, Record<string, unknown>[]> = {
    'daglige-sidevisninger': [
        { dato: '2025-01-06', sidevisninger: 198 }, { dato: '2025-01-07', sidevisninger: 204 },
        { dato: '2025-01-08', sidevisninger: 187 }, { dato: '2025-01-09', sidevisninger: 221 },
        { dato: '2025-01-10', sidevisninger: 210 }, { dato: '2025-01-13', sidevisninger: 235 },
        { dato: '2025-01-14', sidevisninger: 219 }, { dato: '2025-01-15', sidevisninger: 244 },
        { dato: '2025-01-16', sidevisninger: 231 }, { dato: '2025-01-17', sidevisninger: 208 },
        { dato: '2025-01-20', sidevisninger: 197 }, { dato: '2025-01-21', sidevisninger: 215 },
        { dato: '2025-01-22', sidevisninger: 228 }, { dato: '2025-01-23', sidevisninger: 241 },
        { dato: '2025-01-24', sidevisninger: 189 }, { dato: '2025-01-27', sidevisninger: 203 },
        { dato: '2025-01-28', sidevisninger: 217 }, { dato: '2025-01-29', sidevisninger: 252 },
        { dato: '2025-01-30', sidevisninger: 238 }, { dato: '2025-01-31', sidevisninger: 224 },
    ],
    'topp-sider': [
        { side: '/komponenter/core/button', sidevisninger: 1847 },
        { side: '/komponenter/core/input', sidevisninger: 1423 },
        { side: '/god-praksis', sidevisninger: 1201 },
        { side: '/komponenter/core/modal', sidevisninger: 1186 },
        { side: '/komponenter/core/table', sidevisninger: 1054 },
        { side: '/komponenter/core/select', sidevisninger: 978 },
        { side: '/komponenter', sidevisninger: 934 },
        { side: '/komponenter/core/alert', sidevisninger: 891 },
        { side: '/god-praksis/skjema', sidevisninger: 765 },
        { side: '/komponenter/core/chips', sidevisninger: 712 },
        { side: '/monstre', sidevisninger: 634 },
        { side: '/komponenter/core/accordion', sidevisninger: 598 },
    ],
    'per-maaned': [
        { maaned: 1, sidevisninger: 5420 }, { maaned: 2, sidevisninger: 4987 },
        { maaned: 3, sidevisninger: 4612 }, { maaned: 4, sidevisninger: 4301 },
        { maaned: 5, sidevisninger: 4178 }, { maaned: 6, sidevisninger: 3054 },
        { maaned: 7, sidevisninger: 2741 }, { maaned: 8, sidevisninger: 2889 },
        { maaned: 9, sidevisninger: 4102 }, { maaned: 10, sidevisninger: 4534 },
        { maaned: 11, sidevisninger: 4721 }, { maaned: 12, sidevisninger: 3890 },
    ],
    'sideflyt': [
        { steg: '/komponenter/core', antall_besokende: 3420, frafall_pct: 0 },
        { steg: '/komponenter/core/button', antall_besokende: 1847, frafall_pct: 46 },
        { steg: '/komponenter/core/input', antall_besokende: 1102, frafall_pct: 40 },
        { steg: '/god-praksis', antall_besokende: 654, frafall_pct: 41 },
        { steg: '/komponenter/core/modal', antall_besokende: 389, frafall_pct: 41 },
    ],
    'trafikkilder': [
        { kilde: '(direkte)', sidevisninger: 4218 },
        { kilde: 'google.com', sidevisninger: 2904 },
        { kilde: 'nav.no', sidevisninger: 1132 },
        { kilde: 'github.com', sidevisninger: 487 },
        { kilde: 'slack.com', sidevisninger: 214 },
        { kilde: 'confluence.nav.no', sidevisninger: 178 },
        { kilde: 'bing.com', sidevisninger: 96 },
        { kilde: 'teams.microsoft.com', sidevisninger: 84 },
        { kilde: 'duckduckgo.com', sidevisninger: 61 },
        { kilde: 'andre', sidevisninger: 47 },
    ],
    'innkommende-linker': [
        { kilde: '(direkte)', unike_besokende: 3210 },
        { kilde: 'google.com', unike_besokende: 2187 },
        { kilde: 'nav.no', unike_besokende: 891 },
        { kilde: 'github.com', unike_besokende: 412 },
        { kilde: 'confluence.nav.no', unike_besokende: 198 },
        { kilde: 'slack.com', unike_besokende: 167 },
        { kilde: 'dev.to', unike_besokende: 43 },
        { kilde: 'stackoverflow.com', unike_besokende: 38 },
        { kilde: 'bing.com', unike_besokende: 34 },
        { kilde: 'teams.microsoft.com', unike_besokende: 29 },
    ],
    'regresjon': [
        { term: 'Skjæringspunkt (a)', estimat: 709.578, std_feil: 65.333, t_verdi: 10.861, p_verdi: 0, r2: 0.028, rmse: 414.186, n: 285 },
        { term: 'Stigningstall (b)',  estimat: -0.828,  std_feil: 0.292,  t_verdi: -2.837, p_verdi: 0.005, r2: 0.028, rmse: 414.186, n: 285 },
    ],
    'nokkeltal': [
        { kategori: 'Unike besøkende', sesjoner: 4821 },
        { kategori: 'Utførte handlinger', sesjoner: 3187 },
        { kategori: 'Navigering uten handling', sesjoner: 1098 },
        { kategori: 'Forlot nettstedet', sesjoner: 536 },
    ],
    'operativsystem': [
        { operativsystem: 'macOS', unike_besokende: 2804 },
        { operativsystem: 'Windows 10', unike_besokende: 1421 },
        { operativsystem: 'Windows 11', unike_besokende: 687 },
        { operativsystem: 'iOS', unike_besokende: 412 },
        { operativsystem: 'Android', unike_besokende: 318 },
        { operativsystem: '(ukjent)', unike_besokende: 134 },
    ],
    'etter-sok': [
        { neste_side: '/komponenter/core/button', antall_sok: 245 },
        { neste_side: '/komponenter/core/input', antall_sok: 198 },
        { neste_side: '/god-praksis/skjema', antall_sok: 167 },
        { neste_side: '/komponenter/core/modal', antall_sok: 143 },
        { neste_side: '/komponenter/core/table', antall_sok: 128 },
        { neste_side: '/komponenter/core/select', antall_sok: 117 },
        { neste_side: '/god-praksis', antall_sok: 104 },
        { neste_side: '/komponenter/core/alert', antall_sok: 98 },
        { neste_side: '/monstre/sortering', antall_sok: 87 },
        { neste_side: '/komponenter/core/chips', antall_sok: 76 },
        { neste_side: '/god-praksis/tilgjengelighet', antall_sok: 71 },
        { neste_side: '/komponenter/core/accordion', antall_sok: 64 },
    ],
};