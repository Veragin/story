import { observer } from 'mobx-react-lite';
import type { TLinearPassageDto } from '@story/visualizer-protocol';
import { IdCodeField } from '../../../../components/CodeField';
import { PlainTextField } from '../../../../components/PlainTextField';
import { ExecuteField } from './ExecuteField';
import type { TFieldsProps } from './types';

export const LinearFields = observer(
    ({
        draft,
        edit,
        diag,
        passageOptions,
        preamble,
    }: TFieldsProps<TLinearPassageDto>) => (
        <>
            <ExecuteField
                draft={draft}
                edit={edit}
                diag={diag}
                preamble={preamble}
            />
            <PlainTextField
                label={_('Description')}
                multiline
                value={draft.description}
                onChange={(v) =>
                    edit((d) => d.type === 'linear' && (d.description = v))
                }
                diagnostics={diag('description')}
            />
            <IdCodeField
                label={_('Next passage')}
                value={draft.nextPassageId}
                onChange={(v) =>
                    edit(
                        (d) =>
                            d.type === 'linear' &&
                            v !== undefined &&
                            (d.nextPassageId = v)
                    )
                }
                options={passageOptions}
                optional
                removable={false}
                diagnostics={diag('nextPassageId')}
            />
        </>
    )
);
