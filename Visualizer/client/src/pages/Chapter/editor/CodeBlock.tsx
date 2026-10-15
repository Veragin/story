import type { TDiagnosticDto } from '@story/visualizer-protocol';
import { CodeTextArea, FieldDiagnostics } from '../../../components/CodeField';

export const CodeBlock = ({
    code,
    onChange,
    diagnostics,
}: {
    code: string;
    onChange: (code: string) => void;
    diagnostics: TDiagnosticDto[];
}) => (
    <>
        <CodeTextArea
            value={code}
            onChange={onChange}
            hasError={diagnostics.length > 0}
            minRows={3}
        />
        <FieldDiagnostics diagnostics={diagnostics} />
    </>
);
