import type { TDiagnosticDto } from '@story/visualizer-protocol';

export type TInputProps<V, C = V> = {
    value: V;
    onChange: (value: C) => void;
    hasError?: boolean;
    disabled?: boolean;
    // required: the visible label lives in the form variant
    ariaLabel: string;
    dataField?: string;
};

export type TOption = { id: string; label?: string };

export type TDiagnosticsOf = (path: string) => TDiagnosticDto[];

export const NO_DIAGNOSTICS: TDiagnosticsOf = () => [];

export const nestedDiagnostics =
    (diagnosticsOf: TDiagnosticsOf, key: string | number): TDiagnosticsOf =>
    (path) =>
        diagnosticsOf(`${key}.${path}`);
