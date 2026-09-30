import { observer } from 'mobx-react-lite';
import { Typography } from '@mui/material';
import { FunctionInput } from '../../../../components/FunctionInput';
import type { TFieldsProps } from './types';

/**
 * The passage's `execute` (plan D3): runs once when the passage is entered, after its fields
 * were evaluated. Screen passages show it above Body, linear and transition passages at the
 * top of their fields. While the passage function still has statements before its `return`
 * (`preamble`, read-only), a note says they are kept.
 */
export const ExecuteField = observer(
    ({
        draft,
        edit,
        diag,
        preamble,
    }: Pick<TFieldsProps, 'draft' | 'edit' | 'diag' | 'preamble'>) => (
        <>
            <FunctionInput
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
