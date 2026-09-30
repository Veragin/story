import { observer } from 'mobx-react-lite';
import { Divider, Typography } from '@mui/material';
import { isCode, type TScreenPassageDto } from '@story/visualizer-protocol';
import { ImageInput } from '../../../../components/ImageInput';
import { PlainTextField } from '../../../../components/PlainTextField';
import { CodeBlock } from '../CostField';
import { BodyItems } from './BodyItems';
import { ExecuteField } from './ExecuteField';
import type { TFieldsProps } from './types';

/** Title, image, execute and the body (plan phase 6). */
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
            <PlainTextField
                label={_('Title')}
                value={draft.title}
                onChange={(v) =>
                    edit((d) => d.type === 'screen' && (d.title = v))
                }
                diagnostics={diag('title')}
            />
            <ImageInput
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
