import { observer } from 'mobx-react-lite';
import type { TPassageDto, TSequentialPassageDto } from '@story/protocol';
import { FormMaybeCodeAutocompleteInput } from '../../../../components/code/FormMaybeCodeAutocompleteInput';
import type { TFieldsProps } from './types';

const isSequential = (d: TPassageDto): d is TSequentialPassageDto =>
    d.type === 'start' || d.type === 'linear';

export const NextPassageField = observer(
    ({
        draft,
        edit,
        diag,
        passageOptions,
    }: Pick<
        TFieldsProps<TSequentialPassageDto>,
        'draft' | 'edit' | 'diag' | 'passageOptions'
    >) => (
        <FormMaybeCodeAutocompleteInput
            label={_('Next passage')}
            value={draft.nextPassageId}
            onChange={(v) =>
                edit(
                    (d) =>
                        isSequential(d) &&
                        v !== undefined &&
                        (d.nextPassageId = v)
                )
            }
            options={passageOptions}
            // can be added but not removed again
            optional={draft.nextPassageId === undefined}
            diagnostics={diag('nextPassageId')}
            dataField="nextPassageId"
        />
    )
);
