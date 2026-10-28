import { observer } from 'mobx-react-lite';
import { isCode, type TScreenPassageDto } from '@story/protocol';
import { FormImageEditor } from '../../../../components/editors/FormImageEditor';
import { FormMaybeCodeTextInput } from '../../../../components/code/FormMaybeCodeTextInput';
import { FormSection } from '../../../../components/form/FormSection';
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
            <FormMaybeCodeTextInput
                label={_('Title')}
                value={draft.title}
                onChange={(v) =>
                    edit((d) => d.type === 'screen' && (d.title = v ?? ''))
                }
                diagnostics={diag('title')}
                dataField="title"
            />
            <FormImageEditor
                label={_('Image')}
                api={api}
                owner="passages"
                id={draft.passageId}
                value={draft.image}
                onChange={(v) =>
                    edit((d) => d.type === 'screen' && (d.image = v ?? ''))
                }
                diagnostics={diag('image')}
            />
            <ExecuteField
                draft={draft}
                edit={edit}
                diag={diag}
                preamble={preamble}
            />
            <FormSection title={_('Body')}>
                {isCode(draft.body) ? (
                    <CodeBlock
                        code={draft.body.code}
                        onChange={(code) =>
                            edit(
                                (d) =>
                                    d.type === 'screen' && (d.body = { code })
                            )
                        }
                        diagnostics={diag('body')}
                        ariaLabel={_('Body code')}
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
            </FormSection>
        </>
    )
);
