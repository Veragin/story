import { observer } from 'mobx-react-lite';
import { isCode, type TRedirectPassageDto } from '@story/protocol';
import { FormSection } from '../../../../components/form/FormSection';
import { CodeBlock } from '../CodeBlock';
import { ExecuteField } from './ExecuteField';
import { RedirectItems } from './RedirectItems';
import type { TFieldsProps } from './types';

export const RedirectFields = observer(
    ({
        draft,
        edit,
        diag,
        passageOptions,
        itemOptions,
        preamble,
    }: TFieldsProps<TRedirectPassageDto>) => (
        <>
            <ExecuteField
                draft={draft}
                edit={edit}
                diag={diag}
                preamble={preamble}
            />
            <FormSection title={_('Redirects')}>
                {isCode(draft.body) ? (
                    <CodeBlock
                        code={draft.body.code}
                        onChange={(code) =>
                            edit(
                                (d) =>
                                    d.type === 'redirect' && (d.body = { code })
                            )
                        }
                        diagnostics={diag('body')}
                        ariaLabel={_('Redirects code')}
                    />
                ) : (
                    <RedirectItems
                        items={draft.body}
                        onChange={(body) =>
                            edit(
                                (d) => d.type === 'redirect' && (d.body = body)
                            )
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
