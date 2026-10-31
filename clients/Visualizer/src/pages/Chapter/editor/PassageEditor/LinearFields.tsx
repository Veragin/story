import { observer } from 'mobx-react-lite';
import type { TLinearPassageDto } from '@story/protocol';
import { FormMaybeCodeTextInput } from '../../../../components/code/FormMaybeCodeTextInput';
import { ExecuteField } from './ExecuteField';
import { IllustrationFields } from './IllustrationFields';
import { NextPassageField } from './NextPassageField';
import type { TFieldsProps } from './types';

export const LinearFields = observer(
    ({
        draft,
        edit,
        diag,
        passageOptions,
        api,
        preamble,
    }: TFieldsProps<TLinearPassageDto>) => (
        <>
            <IllustrationFields
                draft={draft}
                edit={edit}
                diag={diag}
                api={api}
            />
            <ExecuteField
                draft={draft}
                edit={edit}
                diag={diag}
                preamble={preamble}
            />
            <FormMaybeCodeTextInput
                label={_('Body')}
                multiline
                value={draft.body}
                onChange={(v) =>
                    edit((d) => d.type === 'linear' && (d.body = v ?? ''))
                }
                diagnostics={diag('body')}
                dataField="body"
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
