import { capitalize } from '@story/shared';
import { observer } from 'mobx-react-lite';
import type { TDataTypeDto, TTypeRef } from '@story/protocol';
import { FormFields } from '../../../components/form/FormFields';
import { FormArrayEditor } from '../../../components/editors/FormArrayEditor';
import { DataTypeSection } from '../../Structure/DataTypeSection';
import { FormObjectEditor } from '../../../components/editors/FormObjectEditor';
import { FormMaybeCodeTextInput } from '../../../components/code/FormMaybeCodeTextInput';
import { FormMaybeCodeAutocompleteInput } from '../../../components/code/FormMaybeCodeAutocompleteInput';
import { FormMaybeCodeTimeRangeInput } from '../../../components/code/FormMaybeCodeTimeRangeInput';
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
        diagnostics = noDiagnosticsOf,
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
            <FormFields>
                <FormMaybeCodeTextInput
                    label={_('Title')}
                    value={value.title}
                    onChange={(next) => set('title', next)}
                    diagnostics={diagnostics('title')}
                    disabled={disabled}
                    dataField="title"
                />
                <FormMaybeCodeTextInput
                    label={_('Description')}
                    multiline
                    value={value.description}
                    onChange={(next) => set('description', next)}
                    diagnostics={diagnostics('description')}
                    disabled={disabled}
                    dataField="description"
                />
                <FormMaybeCodeAutocompleteInput
                    label={_('Location')}
                    value={value.location}
                    onChange={(next) => set('location', next)}
                    options={structure.refOptions('TLocation')}
                    diagnostics={diagnostics('location')}
                    disabled={disabled}
                    dataField="location"
                />
                <FormMaybeCodeTimeRangeInput
                    label={_('Time range')}
                    helperText={_('day.month. hour:minute')}
                    value={value.timeRange}
                    onChange={(next) => set('timeRange', next)}
                    endHasError={(end) =>
                        diagnostics(`timeRange.${end}`).length > 0
                    }
                    diagnostics={[
                        ...diagnostics('timeRange'),
                        ...diagnostics('timeRange.start'),
                        ...diagnostics('timeRange.end'),
                    ]}
                    disabled={disabled}
                    dataField="timeRange"
                />
                <StructureContext.Provider
                    value={withoutRefOption(structure, CHAPTER_REF, chapterId)}
                >
                    <FormArrayEditor
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
                <FormObjectEditor
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
                <DataTypeSection
                    value={value.dataType}
                    onChange={setDataType}
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
