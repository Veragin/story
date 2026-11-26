import { observer } from 'mobx-react-lite';
import { LoadingState } from '../../../components/feedback/LoadingState';
import { StructureContext } from '../../../structure/structureContext';
import type { StructureStore } from '../../../stores/StructureStore';
import { ChapterInfoForm } from './ChapterInfoForm';
import type { ChapterInfoEditorStore } from './ChapterInfoEditorStore';

type TProps = {
    store: ChapterInfoEditorStore;
    structure: StructureStore;
};

export const ChapterInfoEditorForm = observer(
    ({ store, structure }: TProps) => {
        if (!store.draft || !store.chapter) {
            return store.error ? null : <LoadingState />;
        }
        return (
            <StructureContext.Provider value={structure}>
                <ChapterInfoForm
                    chapterId={store.chapterId}
                    file={store.chapter.file}
                    value={store.draft}
                    onChange={store.setDraft}
                    diagnostics={store.diagnosticsFor}
                    disabled={store.saving}
                />
            </StructureContext.Provider>
        );
    }
);
