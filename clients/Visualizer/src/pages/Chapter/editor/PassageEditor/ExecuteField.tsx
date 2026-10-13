import { observer } from 'mobx-react-lite';
import { Typography } from '@mui/material';
import { FormFunctionInput } from '../../../../components/inputs/form/FormFunctionInput';
import type { TFieldsProps } from './types';

export const ExecuteField = observer(
    ({
        draft,
        edit,
        diag,
        preamble,
    }: Pick<TFieldsProps, 'draft' | 'edit' | 'diag' | 'preamble'>) => (
        <>
            <FormFunctionInput
                label={_('Execute')}
                value={draft.execute}
                onChange={(v) =>
                    edit((d) => {
                        if (v) d.execute = v;
                        else delete d.execute;
                    })
                }
                optional
                emptyCode="() => {}"
                placeholder={_('What happens when the passage is entered')}
                diagnostics={diag('execute')}
                dataField="execute"
            />
            {preamble && (
                <Typography variant="caption" color="text.secondary">
                    {_(
                        'The passage function has statements before its return; they run on every build of the passage and are kept as they are. Move them into Execute in the source to run them once per entry.'
                    )}
                </Typography>
            )}
        </>
    )
);
