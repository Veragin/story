import type { TDiagnosticDto } from '@story/protocol';

export const NO_DIAGNOSTICS: readonly TDiagnosticDto[] = [];

export const formatDiagnostic = (d: TDiagnosticDto) =>
    `${d.file}:${d.line}:${d.column} ${d.code ? `TS${d.code}: ` : ''}${d.message}`;
