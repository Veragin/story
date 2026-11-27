import { capitalize } from '@story/shared';
import { observer } from 'mobx-react-lite';
import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import type {
    TDataTypeDto,
    TMaybeCode,
    TTypeRef,
    TValue,
    TValueRecord,
} from '@story/protocol';
import { FormFields } from '../../../components/form/FormFields';
import { FormArrayEditor } from '../../../components/editors/FormArrayEditor';
import { DataTypeSection } from '../../Structure/DataTypeSection';
import { FormObjectEditor } from '../../../components/editors/FormObjectEditor';
import { FormMaybeCodeTimeRangeInput } from '../../../components/code/FormMaybeCodeTimeRangeInput';
import { DescriptionInput } from '../../../components/inputs/DescriptionInput';
import {
    noDiagnosticsOf,
    nestedDiagnostics,
    type TDiagnosticsOf,
} from '../../../components/inputs/inputTypes';
import {
    StructureContext,
    typeContextOf,
    useStructureContext,
    withoutRefOption,
} from '../../../structure/structureContext';
import {
    isArrayOf,
    isTextRecord,
    toMaybeCode,
} from '../../../values/valueSource';
import { migrateInit, type TChapterInfoValue } from './chapterInfo';
import { ChapterLocationField } from './ChapterLocationField';

type TChapterInfoFormProps = {
    chapterId: string;
    file: string;
    value: TChapterInfoValue;
    onChange: (value: TChapterInfoValue) => void;
    diagnostics?: TDiagnosticsOf;
    disabled?: boolean;
    parents?: ReactNode;
};

const CHAPTER_REF = 'TChapter';

const CHILD_TYPE: TTypeRef = {
    t: 'object',
    fields: [
        {
            key: 'chapterId',
            type: { t: 'ref', name: CHAPTER_REF },
            optional: false,
        },
        { key: 'condition', type: { t: 'string' }, optional: false },
    ],
};

const isChildren = isArrayOf(isTextRecord(['chapterId', 'condition']));

export const ChapterInfoForm = observer(
    ({
        chapterId,
        file,
        value,
        onChange,
        diagnostics = noDiagnosticsOf,
        disabled,
        parents,
    }: TChapterInfoFormProps) => {
        const structure = useStructureContext();
        // handlers read the latest props, so they stay stable and unchanged sections skip re-rendering
        const latest = useRef({ value, onChange, structure });
        latest.current = { value, onChange, structure };

        const handlers = useMemo(() => {
            const setter =
                <K extends keyof TChapterInfoValue>(key: K) =>
                (next: TChapterInfoValue[K] | undefined) => {
                    const { value: current, onChange: change } = latest.current;
                    if (next !== undefined) change({ ...current, [key]: next });
                };
            const setChildren = setter('children');
            const setInit = setter('init');
            return {
                docComment: setter('docComment'),
                location: setter('location'),
                timeRange: setter('timeRange'),
                children: (next: TValue[] = []) =>
                    setChildren(toMaybeCode(next, isChildren)),
                init: (next: TMaybeCode<TValueRecord> = {}) => setInit(next),
                dataType: (
                    dataType: TDataTypeDto,
                    renames: Record<string, string>
                ) => {
                    const { value: current, onChange: change } = latest.current;
                    change({
                        ...current,
                        dataType,
                        init: dataType.fields
                            ? migrateInit(
                                  current.init,
                                  current.dataType?.fields ?? [],
                                  dataType.fields,
                                  renames,
                                  typeContextOf(latest.current.structure)
                              )
                            : current.init,
                    });
                },
            };
        }, []);

        const rangeDiagnostics = diagnostics('timeRange');
        const startDiagnostics = diagnostics('timeRange.start');
        const endDiagnostics = diagnostics('timeRange.end');
        const timeRangeDiagnostics = useMemo(
            () => [...rangeDiagnostics, ...startDiagnostics, ...endDiagnostics],
            [rangeDiagnostics, startDiagnostics, endDiagnostics]
        );
        const timeRangeEndHasError = useCallback(
            (end: string) => diagnostics(`timeRange.${end}`).length > 0,
            [diagnostics]
        );
        const childrenDiagnosticsOf = useMemo(
            () => nestedDiagnostics(diagnostics, 'children'),
            [diagnostics]
        );
        const initDiagnosticsOf = useMemo(
            () => nestedDiagnostics(diagnostics, 'init'),
            [diagnostics]
        );
        const childStructure = useMemo(
            () => withoutRefOption(structure, CHAPTER_REF, chapterId),
            [structure, chapterId]
        );
        const fields = value.dataType?.fields;

        return (
            <FormFields>
                <DescriptionInput
                    value={value.docComment ?? ''}
                    onChange={handlers.docComment}
                    disabled={disabled}
                    minRows={6}
                />
                <ChapterLocationField
                    value={value.location}
                    onChange={handlers.location}
                    diagnostics={diagnostics('location')}
                    disabled={disabled}
                />
                <FormMaybeCodeTimeRangeInput
                    label={_('Time range')}
                    helperText={_('day.month. hour:minute')}
                    value={value.timeRange}
                    onChange={handlers.timeRange}
                    endHasError={timeRangeEndHasError}
                    diagnostics={timeRangeDiagnostics}
                    disabled={disabled}
                    dataField="timeRange"
                />
                {parents}
                <StructureContext.Provider value={childStructure}>
                    <FormArrayEditor
                        label={_('Child chapters')}
                        itemType={CHILD_TYPE}
                        value={value.children}
                        onChange={handlers.children}
                        diagnostics={diagnostics('children')}
                        diagnosticsOf={childrenDiagnosticsOf}
                        disabled={disabled}
                        dataField="children"
                    />
                </StructureContext.Provider>
                <FormObjectEditor
                    label={_('Init')}
                    value={value.init}
                    onChange={handlers.init}
                    fields={fields}
                    // without a known data type the keys are free, typed by their values
                    allowCustomFields={!fields}
                    diagnostics={diagnostics('init')}
                    diagnosticsOf={initDiagnosticsOf}
                    disabled={disabled}
                    dataField="init"
                />
                <DataTypeSection
                    value={value.dataType}
                    onChange={handlers.dataType}
                    newName={`T${capitalize(chapterId)}ChapterData`}
                    file={file}
                    diagnostics={diagnostics('dataType')}
                    disabled={disabled}
                    dataField="dataType"
                />
            </FormFields>
        );
    }
);
