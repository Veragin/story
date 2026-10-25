import { useEffect, useMemo, useRef } from 'react';
import { styled } from '@mui/material';
import CodeMirror, {
    EditorView,
    type EditorState,
} from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import type { TDiagnosticDto } from '@story/protocol';

type TProps = {
    value: string;
    onChange: (value: string) => void;
    diagnostics?: readonly TDiagnosticDto[];
    jsx?: boolean;
    readOnly?: boolean;
    autoFocus?: boolean;
    height?: string;
    minHeight?: string;
    ariaLabel?: string;
};

const NO_DIAGNOSTICS: readonly TDiagnosticDto[] = [];

// server positions are 1-based
const toCodeMirror = (
    state: EditorState,
    diagnostics: readonly TDiagnosticDto[]
): Diagnostic[] =>
    diagnostics.map((d) => {
        const line = state.doc.line(
            Math.min(Math.max(1, d.line), state.doc.lines)
        );
        const from = Math.min(line.from + Math.max(0, d.column - 1), line.to);
        const word =
            /^[\w$]+/.exec(state.doc.sliceString(from, line.to))?.[0].length ??
            0;
        return {
            from,
            to: from + Math.max(word, from < line.to ? 1 : 0),
            severity: 'error',
            message: d.code ? `TS${d.code}: ${d.message}` : d.message,
        };
    });

const showDiagnostics = (
    view: EditorView | null,
    diagnostics: readonly TDiagnosticDto[]
) => {
    if (!view) return;
    view.dispatch(
        setDiagnostics(view.state, toCodeMirror(view.state, diagnostics))
    );
};

export const CodeEditor = ({
    value,
    onChange,
    diagnostics = NO_DIAGNOSTICS,
    jsx = false,
    readOnly = false,
    autoFocus = false,
    height,
    minHeight,
    ariaLabel,
}: TProps) => {
    const viewRef = useRef<EditorView | null>(null);
    const diagnosticsRef = useRef(diagnostics);
    diagnosticsRef.current = diagnostics;

    useEffect(
        () => showDiagnostics(viewRef.current, diagnostics),
        [diagnostics]
    );

    const extensions = useMemo(
        () => [
            javascript({ typescript: true, jsx }),
            lintGutter(),
            EditorView.lineWrapping,
            ...(ariaLabel
                ? [EditorView.contentAttributes.of({ 'aria-label': ariaLabel })]
                : []),
        ],
        [jsx, ariaLabel]
    );

    return (
        <SEditor data-code-editor>
            <CodeMirror
                value={value}
                onChange={onChange}
                extensions={extensions}
                theme="dark"
                height={height}
                minHeight={minHeight}
                autoFocus={autoFocus}
                readOnly={readOnly}
                onCreateEditor={(view) => {
                    viewRef.current = view;
                    showDiagnostics(view, diagnosticsRef.current);
                }}
            />
        </SEditor>
    );
};

const SEditor = styled('div')`
    flex: 1;
    min-height: 0;
    overflow: hidden;
    font-size: 13px;

    & > div {
        height: 100%;
    }
`;
