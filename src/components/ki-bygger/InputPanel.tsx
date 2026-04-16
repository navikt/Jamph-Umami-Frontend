import { useState } from 'react';
import { Alert, BodyShort, Button, Label, Textarea, TextField } from '@navikt/ds-react';

const KiIcon = () => (
    <span
        aria-hidden
        className="shrink-0 mt-0.5 inline-flex items-center justify-center rounded-full text-white font-bold"
        style={{ width: 20, height: 20, fontSize: 9, lineHeight: 1, backgroundColor: '#0067C5' }}
    >
        KI
    </span>
);

const NAV_DOMAINS = ['nav.no', 'aksel.nav.no', 'arbeidsplassen.nav.no'];

function validateNavUrl(value: string): string | null {
    if (!value.trim()) return null;
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
        const { hostname } = new URL(normalized);
        const isNav = NAV_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));
        if (!isNav) return 'URL må være en nav.no-adresse (f.eks. nav.no/sykepenger)';
    } catch {
        return 'Ugyldig URL. Eksempel: nav.no/sykepenger';
    }
    return null;
}

interface InputPanelProps {
    url: string;
    onUrlChange: (v: string) => void;
    kiPrompt: string;
    onKiPromptChange: (v: string) => void;
    kiSuggestion: string | null;
    onHentGraf: () => void;
    loading?: boolean;
    error?: string | null;
}

export default function InputPanel({
    url,
    onUrlChange,
    kiPrompt,
    onKiPromptChange,
    kiSuggestion,
    onHentGraf,
    loading = false,
    error = null,
}: InputPanelProps) {
    const [urlTouched, setUrlTouched] = useState(false);
    const urlError = urlTouched ? validateNavUrl(url) : null;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginTop: '1.5rem' }}>
            {/* Boks 1 – URL */}
            <div className="border border-gray-200 rounded-lg bg-white p-4">
                <TextField
                    label="Lim inn URL for å se webstatistikk"
                    placeholder="https://www.nav.no/..."
                    value={url}
                    onChange={(e) => { onUrlChange(e.target.value); setUrlTouched(true); }}
                    onBlur={() => setUrlTouched(true)}
                    type="url"
                    error={urlError ?? undefined}
                />
            </div>

            {/* Boks 2 – KI-Assistent */}
            <div className="border border-gray-200 rounded-lg bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                    <Label>✨ KI-Assistent</Label>
                </div>

                <div className="flex gap-2 items-end">
                    <Textarea
                        label="KI-spørsmål"
                        hideLabel
                        placeholder="Eksempel: Vis daglige sidevisninger for aksel.nav.no i 2025"
                        value={kiPrompt}
                        onChange={(e) => onKiPromptChange(e.target.value)}
                        minRows={2}
                        className="flex-1"
                    />
                    <Button
                        variant="primary"
                        size="small"
                        onClick={onHentGraf}
                        disabled={!url.trim() || !kiPrompt.trim() || !!validateNavUrl(url)}
                        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                        Hent graf
                    </Button>
                </div>

                {error && (
                    <Alert variant="error" size="small" className="mt-3">
                        {error}
                    </Alert>
                )}

                {kiSuggestion !== null && (
                    <div className="mt-3 flex items-start gap-2 rounded-md px-3 py-2" style={{ border: '1px solid var(--a-border-info)', backgroundColor: 'var(--a-surface-info-subtle)' }}>
                        <KiIcon />
                        <BodyShort size="small">{kiSuggestion}</BodyShort>
                    </div>
                )}
            </div>
        </div>
    );
}
