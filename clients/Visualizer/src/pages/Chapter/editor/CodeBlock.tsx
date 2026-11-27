import type { TDiagnosticDto } from '@story/protocol';
import { CodeTextArea } from '../../../components/code/CodeTextArea';
import { FieldDiagnostics } from '../../../components/form/FieldDiagnostics';

export const CodeBlock = ({
    code,
    onChange,
    diagnostics,
    ariaLabel,
}: {
    code: string;
    ariaLabel: string;
    onChange: (code: string) => void;
    diagnostics: TDiagnosticDto[];
}) => (
    <>
        <CodeTextArea
            value={code}
            onChange={onChange}
            hasError={diagnostics.length > 0}
            minRows={3}
            ariaLabel={ariaLabel}
        />
        <FieldDiagnostics diagnostics={diagnostics} />
    </>
);
