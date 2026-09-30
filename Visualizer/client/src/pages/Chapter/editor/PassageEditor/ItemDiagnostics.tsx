import { Alert } from '@mui/material';
import type { TDiagnosticDto } from '@story/visualizer-protocol';
import { SList } from './styles';

/** The diagnostics of a body item or link as a compact list (nothing when there are none). */
export const ItemDiagnostics = ({
    diagnostics,
}: {
    diagnostics: TDiagnosticDto[];
}) =>
    diagnostics.length === 0 ? null : (
        <Alert severity="error" sx={{ py: 0 }}>
            <SList>
                {diagnostics.map((d, i) => (
                    <li key={i}>{d.message}</li>
                ))}
            </SList>
        </Alert>
    );
