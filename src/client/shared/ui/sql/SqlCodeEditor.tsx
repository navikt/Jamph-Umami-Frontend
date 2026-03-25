import Editor from '@monaco-editor/react';

interface SqlCodeEditorProps {
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly height?: number;
}

export default function SqlCodeEditor({ value, onChange, height = 320 }: SqlCodeEditorProps) {
    return (
        <Editor
            height={height}
            defaultLanguage="sql"
            value={value}
            onChange={(val) => onChange(val || '')}
            theme="vs-dark"
            options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                fixedOverflowWidgets: true,
                stickyScroll: { enabled: false },
                lineNumbersMinChars: 4,
                glyphMargin: false,
            }}
        />
    );
}
