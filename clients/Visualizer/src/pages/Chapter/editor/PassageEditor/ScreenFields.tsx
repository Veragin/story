import { observer } from 'mobx-react-lite';
import { isCode, type TScreenPassageDto } from '@story/protocol';
import { FormSection } from '../../../../components/form/FormSection';
import { CodeBlock } from '../CodeBlock';
import { BodyItems } from './BodyItems';
import { ExecuteField } from './ExecuteField';
import { IllustrationFields } from './IllustrationFields';
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
