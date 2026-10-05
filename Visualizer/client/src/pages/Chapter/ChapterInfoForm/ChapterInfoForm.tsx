import { capitalize } from '@story/shared';
import { styled } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { spacingCss } from '@story/ui';
import type { TDataTypeDto, TTypeRef } from '@story/visualizer-protocol';
import { FormArrayInput } from '../../../components/inputs/form/FormArrayInput';
import { FormDataTypeInput } from '../../../components/inputs/form/FormDataTypeInput';
import { FormObjectInput } from '../../../components/inputs/form/FormObjectInput';
import { FormStringInput } from '../../../components/inputs/form/FormStringInput';
import { FormTypeInput } from '../../../components/inputs/form/FormTypeInput';
import {
    NO_DIAGNOSTICS,
    nestedDiagnostics,
    type TDiagnosticsOf,
} from '../../../components/inputs/inputTypes';
import {
    StructureContext,
    typeContextOf,
    useStructureContext,
    withoutRefOption,
} from '../../../components/inputs/structureContext';
import {
    isArrayOf,
    isTextRecord,
    toMaybeCode,
} from '../../../components/inputs/valueSource';
import { migrateInit, type TChapterInfoValue } from './chapterInfo';
import { TimeRangeInput } from './TimeRangeInput';

type TChapterInfoFormProps = {
    chapterId: string;
    file: string;
    value: TChapterInfoValue;
    onChange: (value: TChapterInfoValue) => void;
    diagnostics?: TDiagnosticsOf;
    disabled?: boolean;
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
        diagnostics = NO_DIAGNOSTICS,
        disabled,
    }: TChapterInfoFormProps) => {
        const structure = useStructureContext();
        const set = <K extends keyof TChapterInfoValue>(
            key: K,
            next: TChapterInfoValue[K] | undefined
        ) => {
            if (next !== undefined) onChange({ ...value, [key]: next });
        };
        const setDataType = (
            dataType: TDataTypeDto,
            renames: Record<string, string>
        ) =>
            onChange({
                ...value,
                dataType,
                init: dataType.fields
                    ? migrateInit(
                          value.init,
                          value.dataType?.fields ?? [],
                          dataType.fields,
                          renames,
                          typeContextOf(structure)
                      )
                    : value.init,
            });
        const fields = value.dataType?.fields;

        return (
            <SForm>
                <FormStringInput
                    label={_('Title')}
                    value={value.title}
                    onChange={(next) => set('title', next)}
                    diagnostics={diagnostics('title')}
                    disabled={disabled}
                    dataField="title"
                />
                <FormStringInput
                    label={_('Description')}
                    multiline
                    value={value.description}
                    onChange={(next) => set('description', next)}
                    diagnostics={diagnostics('description')}
                    disabled={disabled}
                    dataField="description"
                />
                <FormTypeInput
                    label={_('Location')}
                    value={value.location}
                    onChange={(next) => set('location', next)}
                    options={structure.refOptions('TLocation')}
                    diagnostics={diagnostics('location')}
                    disabled={disabled}
                    dataField="location"
                />
                <TimeRangeInput
                    value={value.timeRange}
                    onChange={(next) => set('timeRange', next)}
                    diagnostics={diagnostics}
                    disabled={disabled}
                />
                <StructureContext.Provider
                    value={withoutRefOption(structure, CHAPTER_REF, chapterId)}
                >
                    <FormArrayInput
                        label={_('Child chapters')}
                        itemType={CHILD_TYPE}
                        value={value.children}
                        onChange={(next = []) =>
                            set('children', toMaybeCode(next, isChildren))
                        }
                        diagnostics={diagnostics('children')}
                        diagnosticsOf={nestedDiagnostics(
                            diagnostics,
                            'children'
                        )}
                        disabled={disabled}
                        dataField="children"
                    />
                </StructureContext.Provider>
                <FormObjectInput
                    label={_('Init')}
                    value={value.init}
                    onChange={(next = {}) => set('init', next)}
                    fields={fields}
                    // without a known data type the keys are free, typed by their values
                    allowCustomFields={!fields}
                    diagnostics={diagnostics('init')}
                    diagnosticsOf={nestedDiagnostics(diagnostics, 'init')}
                    disabled={disabled}
                    dataField="init"
                />
                <FormDataTypeInput
                    value={value.dataType}
                    onChange={setDataType}
                    newName={`T${capitalize(chapterId)}ChapterData`}
                    file={file}
                    diagnostics={diagnostics('dataType')}
                    disabled={disabled}
                    dataField="dataType"
                />
            </SForm>
        );
    }
);

const SForm = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1.5)};
    min-width: 0;
`;
