import { Alert } from '@navikt/ds-react';

interface UnsupportedWidgetProps {
    readonly chartType: string;
}

export default function UnsupportedWidget({ chartType }: UnsupportedWidgetProps) {
    return (
        <Alert variant="warning" size="small">
            Widgettype ikke stottet: {chartType}
        </Alert>
    );
}
