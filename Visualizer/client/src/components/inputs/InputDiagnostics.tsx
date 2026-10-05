import { styled } from '@mui/material';
import type { TDiagnosticDto } from '@story/visualizer-protocol';

type TProps = {
    diagnostics?: TDiagnosticDto[];
    messages?: string[];
};

export const InputDiagnostics = ({
    diagnostics = [],
    messages = [],
}: TProps) =>
    diagnostics.length === 0 && messages.length === 0 ? null : (
        <SDiagnostics data-diagnostics>
            {messages.map((message, i) => (
                <li key={`m${i}`}>{message}</li>
            ))}
            {diagnostics.map((d, i) => (
                <li key={`d${i}`}>
                    {d.message}
                    <SWhere>
                        {' '}
                        ({d.file}:{d.line}:{d.column})
                    </SWhere>
                </li>
            ))}
        </SDiagnostics>
    );

const SDiagnostics = styled('ul')`
    margin: 2px 0 0;
    padding-left: 18px;
    color: #f44336;
    font-size: 12px;
`;

const SWhere = styled('span')`
    opacity: 0.7;
`;
