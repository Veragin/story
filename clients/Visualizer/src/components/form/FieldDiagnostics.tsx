import { styled } from '@mui/material';
import type { TDiagnosticDto } from '@story/protocol';

type TProps = {
    diagnostics?: readonly TDiagnosticDto[];
    messages?: string[];
};

export const FieldDiagnostics = ({
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
    color: ${({ theme }) => theme.palette.error.main};
    font-size: ${({ theme }) => theme.typography.meta.fontSize};
`;

const SWhere = styled('span')`
    opacity: 0.7;
`;
