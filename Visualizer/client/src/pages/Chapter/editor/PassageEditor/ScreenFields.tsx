import { observer } from 'mobx-react-lite';
import { Divider, Typography } from '@mui/material';
import { isCode, type TScreenPassageDto } from '@story/visualizer-protocol';
import { FormImageInput } from '../../../../components/inputs/form/FormImageInput';
import { FormStringInput } from '../../../../components/inputs/form/FormStringInput';
import { CodeBlock } from '../CodeBlock';
import { BodyItems } from './BodyItems';
import { ExecuteField } from './ExecuteField';
import type { TFieldsProps } from './types';

export const ScreenFields = observer(
    ({
        draft,
        edit,
        diag,
        passageOptions,
        itemOptions,
        api,
        preamble,
    }: TFieldsProps<TScreenPassageDto>) => (
        <>
            <FormStringInput
                label={_('Title')}
                value={draft.title}
                onChange={(v) =>
                    edit((d) => d.type === 'screen' && (d.title = v ?? ''))
                }
                diagnostics={diag('title')}
                dataField="title"
            />
            <FormImageInput
                api={api}
                owner="passages"
                id={draft.passageId}
                description={draft.image}
                onDescriptionChange={(v) =>
                    edit((d) => d.type === 'screen' && (d.image = v))
                }
                diagnostics={diag('image')}
            />
            <ExecuteField
                draft={draft}
                edit={edit}
                diag={diag}
                preamble={preamble}
            />
            <Divider />
            <Typography variant="subtitle2">{_('Body')}</Typography>
            {isCode(draft.body) ? (
                <CodeBlock
                    code={draft.body.code}
                    onChange={(code) =>
                        edit((d) => d.type === 'screen' && (d.body = { code }))
                    }
                    diagnostics={diag('body')}
                />
            ) : (
                <BodyItems
                    items={draft.body}
                    onChange={(body) =>
                        edit((d) => d.type === 'screen' && (d.body = body))
                    }
                    diag={diag}
                    passageOptions={passageOptions}
                    itemOptions={itemOptions}
                />
            )}
        </>
    )
);
