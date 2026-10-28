import type { ReactNode } from 'react';
import { Alert, AlertTitle, styled } from '@mui/material';
import type { TDiagnosticDto } from '@story/protocol';
import { formatDiagnostic } from '../../api/diagnostics';
import { BulletList } from './BulletList';

type TProps = {
    diagnostics: readonly TDiagnosticDto[];
    title?: string;
    children?: ReactNode;
    className?: string;
};

export const DiagnosticsList = ({
    diagnostics,
    title,
    children,
    className,
}: TProps) =>
    diagnostics.length > 0 ? (
        <Alert severity="error" className={className} data-notice="diagnostics">
            {title && <AlertTitle>{title}</AlertTitle>}
            {children}
            <BulletList>
                {diagnostics.map((d, i) => (
                    <li key={i}>
                        <code>{formatDiagnostic(d)}</code>
                        {d.field && <SField> [{d.field}]</SField>}
                    </li>
                ))}
            </BulletList>
        </Alert>
    ) : null;

const SField = styled('span')`
    opacity: 0.8;
`;
