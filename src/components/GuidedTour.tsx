import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@navikt/ds-react';

interface TourStep {
    selector: string;
    title: string;
    description: string;
    tooltipSide: 'top' | 'bottom';
    /** If true, clicking "Neste" will programmatically click the target */
    clickOnNext?: boolean;
}

const STEPS: TourStep[] = [
    {
        selector: '#ki-bygger-accordion button',
        title: 'Åpne KI byggeren',
        description: 'Klikk her for å åpne KI byggeren.',
        tooltipSide: 'bottom',
        clickOnNext: true,
    },
    {
        selector: '[data-tour="prompt-input"]',
        title: 'Skriv spørsmålet ditt',
        description: 'Klikk på tekstboksen — et eksempel fylles automatisk ut. Du kan beholde det eller skrive ditt eget.',
        tooltipSide: 'bottom',
        clickOnNext: true,
    },
    {
        selector: '[data-tour="lag-graf"]',
        title: 'Lag grafen',
        description: 'Klikk "Lag graf" for å generere en visualisering basert på spørsmålet ditt.',
        tooltipSide: 'top',
        clickOnNext: true,
    },
    {
        selector: '[data-tour="legg-til"]',
        title: 'Legg til på dashboard',
        description: 'Grafen er klar! Klikk her for å åpne størrelsesvelgeren.',
        tooltipSide: 'top',
        clickOnNext: true,
    },
    {
        selector: '[data-tour="size-2x1"]',
        title: 'Velg størrelse',
        description: 'Velg 2×1 for en bred graf på dashboardet.',
        tooltipSide: 'bottom',
        clickOnNext: true,
    },
    {
        selector: '[data-pinned-grid]',
        title: 'Flytt grafen rundt',
        description: 'Dra grafene rundt på dashboardet for å tilpasse layouten. Dobbeltklikk på en graf for å redigere eller slette den.',
        tooltipSide: 'top',
        clickOnNext: false,
    },
];

const PAD = 8;

interface Rect { top: number; left: number; width: number; height: number; }

function getRect(selector: string): Rect | null {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function Spotlight({ rect }: Readonly<{ rect: Rect }>) {
    const t = rect.top - PAD;
    const l = rect.left - PAD;
    const w = rect.width + PAD * 2;
    const h = rect.height + PAD * 2;
    return (
        <svg style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9998 }}>
            <defs>
                <mask id="tour-mask">
                    <rect width="100%" height="100%" fill="white" />
                    <rect x={l} y={t} width={w} height={h} rx={6} fill="black" />
                </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#tour-mask)" />
            <rect x={l} y={t} width={w} height={h} rx={6} fill="none" stroke="#0067C5" strokeWidth={2} />
        </svg>
    );
}

function Tooltip({ rect, step, stepIdx, total, onNext, onClose }: Readonly<{
    rect: Rect;
    step: TourStep;
    stepIdx: number;
    total: number;
    onNext: () => void;
    onClose: () => void;
}>) {
    const tooltipW = 280;
    let top = step.tooltipSide === 'bottom'
        ? rect.top + rect.height + PAD + 8
        : rect.top - PAD - 8 - 130;
    let left = rect.left + rect.width / 2 - tooltipW / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipW - 12));

    return (
        <div style={{
            position: 'fixed', top, left, width: tooltipW, zIndex: 9999,
            background: '#fff', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            padding: '16px', fontFamily: 'inherit',
        }}>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: '0 0 6px' }}>{step.title}</p>
            <p style={{ fontSize: '0.875rem', color: '#444', margin: '0 0 14px', lineHeight: 1.5 }}>{step.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#888' }}>Steg {stepIdx + 1} av {total}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="tertiary" size="xsmall" onClick={onClose}>Hopp over</Button>
                    <Button variant="primary" size="xsmall" onClick={onNext}>
                        {stepIdx === total - 1 ? 'Ferdig' : 'Neste →'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface GuidedTourProps {
    active: boolean;
    onClose: () => void;
}

export default function GuidedTour({ active, onClose }: GuidedTourProps) {
    const [stepIdx, setStepIdx] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const rafRef = useRef<number>(0);
    const skipNextClickRef = useRef(false);

    const currentStep = STEPS[stepIdx];

    const advance = useCallback(() => {
        if (stepIdx < STEPS.length - 1) {
            setStepIdx(s => s + 1);
        } else {
            onClose();
        }
    }, [stepIdx, onClose]);

    // rAF loop to track target element position
    const measureRect = useCallback(() => {
        if (!active) return;
        setRect(getRect(currentStep.selector));
        rafRef.current = requestAnimationFrame(measureRect);
    }, [active, currentStep.selector]);

    useEffect(() => {
        if (!active) return;
        rafRef.current = requestAnimationFrame(measureRect);
        return () => cancelAnimationFrame(rafRef.current);
    }, [active, measureRect]);

    // Auto-advance when user clicks the highlighted element themselves
    useEffect(() => {
        if (!active || !rect) return;
        const el = document.querySelector<HTMLElement>(currentStep.selector);
        if (!el) return;

        const handler = () => {
            if (skipNextClickRef.current) {
                skipNextClickRef.current = false;
                return;
            }
            advance();
        };

        el.addEventListener('click', handler);
        return () => el.removeEventListener('click', handler);
    }, [active, rect, currentStep.selector, advance]);

    const handleNext = () => {
        if (currentStep.clickOnNext) {
            skipNextClickRef.current = true;
            const el = document.querySelector<HTMLElement>(currentStep.selector);
            el?.click();
        }
        advance();
    };

    if (!active || !rect) return null;

    return (
        <>
            <Spotlight rect={rect} />
            <Tooltip
                rect={rect}
                step={currentStep}
                stepIdx={stepIdx}
                total={STEPS.length}
                onNext={handleNext}
                onClose={onClose}
            />
        </>
    );
}
