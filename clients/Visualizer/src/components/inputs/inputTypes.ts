import type { TDiagnosticDto } from '@story/protocol';
import { NO_DIAGNOSTICS } from '../../api/diagnostics';

export type TInputProps<V, C = V> = {
    value: V;
    onChange: (value: C) => void;
    hasError?: boolean;
    disabled?: boolean;
    // required: the visible label lives in the form variant
    ariaLabel: string;
    dataField?: string;
};

export type TDiagnosticsOf = (path: string) => readonly TDiagnosticDto[];

export const noDiagnosticsOf: TDiagnosticsOf = () => NO_DIAGNOSTICS;

export const nestedDiagnostics =
    (diagnosticsOf: TDiagnosticsOf, key: string | number): TDiagnosticsOf =>
    (path) =>
        diagnosticsOf(`${key}.${path}`);
