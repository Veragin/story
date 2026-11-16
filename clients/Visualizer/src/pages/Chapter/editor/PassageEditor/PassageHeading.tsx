import { observer } from 'mobx-react-lite';
import { isCode } from '@story/protocol';
import { SidebarHeading } from '../../../../components/layout/SidebarHeading';
import { isIllustrated } from './passageKinds';
import type { TFieldsProps } from './types';

export const PassageHeading = observer(
    ({ draft, edit }: Pick<TFieldsProps, 'draft' | 'edit'>) =>
        isIllustrated(draft) && !isCode(draft.title) ? (
            <SidebarHeading
                title={draft.title}
                badge={draft.type}
                placeholder={draft.localId}
                dataField="title"
                onTitleChange={(title) =>
                    edit((d) => isIllustrated(d) && (d.title = title))
                }
            />
        ) : (
            <SidebarHeading title={draft.localId} badge={draft.type} />
        )
);
