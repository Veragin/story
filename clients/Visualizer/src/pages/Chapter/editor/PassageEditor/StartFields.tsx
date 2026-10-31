import { observer } from 'mobx-react-lite';
import type { TStartPassageDto } from '@story/protocol';
import { FormMaybeCodeTextInput } from '../../../../components/code/FormMaybeCodeTextInput';
import { ExecuteField } from './ExecuteField';
import { NextPassageField } from './NextPassageField';
import type { TFieldsProps } from './types';

export const StartFields = observer(
    ({
        draft,
        edit,
        diag,
        passageOptions,
        preamble,
    }: TFieldsProps<TStartPassageDto>) => (
        <>
            <ExecuteField
                draft={draft}
                edit={edit}
                diag={diag}
                preamble={preamble}
            />
            <FormMaybeCodeTextInput
                label={_('Description')}
                multiline
                value={draft.description}
                onChange={(v) =>
                    edit(
                        (d) => d.type === 'start' && (d.description = v ?? '')
                    )
                }
                diagnostics={diag('description')}
                dataField="description"
            />
            <NextPassageField
                draft={draft}
                edit={edit}
                diag={diag}
                passageOptions={passageOptions}
            />
        </>
    )
);
