import { observer } from 'mobx-react-lite';
import { ConflictAlert } from '../../../components/feedback/ConflictAlert';
import { DiagnosticsList } from '../../../components/feedback/DiagnosticsList';
import type { ChapterInfoEditorStore } from './ChapterInfoEditorStore';

type TProps = {
    store: ChapterInfoEditorStore;
};

export const ChapterInfoAlerts = observer(({ store }: TProps) => (
    <>
        {store.conflict && (
            <ConflictAlert
                deleted={!store.conflict.current}
                what={_('chapter')}
                onReload={
                    store.conflict.current
                        ? () => store.reloadFromDisk()
                        : undefined
                }
                onKeepMine={
                    store.conflict.current ? () => store.keepMine() : undefined
                }
            />
        )}
        <DiagnosticsList diagnostics={store.unmappedDiagnostics} />
    </>
));
