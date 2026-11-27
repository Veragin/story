import { observer } from 'mobx-react-lite';
import type { TIllustratedPassageDto } from '@story/protocol';
import { FormImageEditor } from '../../../../components/editors/FormImageEditor';
import { isIllustrated } from './passageKinds';
import type { TFieldsProps } from './types';

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
        <FormImageEditor
            label={_('Image')}
            api={api}
            owner="passages"
            id={draft.passageId}
            linkFrom={draft.file}
            value={draft.image}
            onChange={(v) =>
                edit((d) => isIllustrated(d) && (d.image = v ?? ''))
            }
            diagnostics={diag('image')}
        />
    )
);
