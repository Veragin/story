import type { TDiagnosticDto, TPassageDto } from '@story/visualizer-protocol';
import type { TOption } from '../../../../components/inputs/inputTypes';
import type { TVisualizerApi } from '../../../../api';

export type TDiag = (path: string) => TDiagnosticDto[];

type TEditFn = (mutate: (draft: TPassageDto) => void) => void;

export type TOptionsProps = {
    passageOptions: TOption[];
    itemOptions: TOption[];
};

export type TFieldsProps<D extends TPassageDto = TPassageDto> = TOptionsProps & {
    draft: D;
    transitionOptions: TOption[];
    edit: TEditFn;
    diag: TDiag;
    api?: TVisualizerApi;
    preamble?: string;
};

export type TListProps<T> = TOptionsProps & {
    items: T[];
    onChange: (items: T[]) => void;
    diag: TDiag;
};
