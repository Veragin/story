import type { TDiagnosticDto } from '@story/visualizer-protocol';
import { CodeTextArea } from '../../../components/inputs/CodeTextArea';
import { InputDiagnostics } from '../../../components/inputs/InputDiagnostics';

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
        <InputDiagnostics diagnostics={diagnostics} />
    </>
);
