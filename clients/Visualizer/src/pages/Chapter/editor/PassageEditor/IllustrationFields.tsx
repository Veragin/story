import { observer } from 'mobx-react-lite';
import type { TIllustratedPassageDto, TPassageDto } from '@story/protocol';
import { FormImageEditor } from '../../../../components/editors/FormImageEditor';
import { FormMaybeCodeTextInput } from '../../../../components/code/FormMaybeCodeTextInput';
import type { TFieldsProps } from './types';

const isIllustrated = (d: TPassageDto): d is TIllustratedPassageDto =>
    d.type === 'screen' || d.type === 'linear';

export const IllustrationFields = observer(
    ({
        draft,
        edit,
        diag,
        api,
    }: Pick<
        TFieldsProps<TIllustratedPassageDto>,
        'draft' | 'edit' | 'diag' | 'api'
    >) => (
        <>
            <FormMaybeCodeTextInput
                label={_('Title')}
                value={draft.title}
                onChange={(v) =>
                    edit((d) => isIllustrated(d) && (d.title = v ?? ''))
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
                    edit((d) => isIllustrated(d) && (d.image = v ?? ''))
                }
                diagnostics={diag('image')}
            />
        </>
    )
);
