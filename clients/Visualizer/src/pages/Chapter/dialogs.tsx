import type { TReferenceDto } from '@story/protocol';
import { errorMessage, type TVisualizerApi } from '../../api';
import { entityStore, structureStore } from '../../context';
import { modals } from '../../shell';
import { ReferencedError, type ChapterGraphStore } from './ChapterGraphStore';
import { AddCharacterDialog } from './AddCharacterDialog';
import { AddPassageDialog } from './AddPassageDialog';
import { ReferencesDialog } from '../../components/dialog/ReferencesDialog';
import { ChapterInfoDialog } from './ChapterInfoForm/ChapterInfoDialog';
import { passageIdPrefix } from './dialogUtils';
import type { TPassageCreator } from './editor/PassageEditor/types';

const showReferences = (
    title: string,
    message: string,
    references: TReferenceDto[]
) =>
    modals.open((close) => (
        <ReferencesDialog
            title={title}
            message={message}
            references={references}
            onClose={close}
        />
    ));

export const openAddCharacter = (
    store: ChapterGraphStore,
    onAdded?: (characterId: string) => void
) => {
    void store.refetchProject();
    modals.open((close) => (
        <AddCharacterDialog store={store} onClose={close} onAdded={onAdded} />
    ));
};

export const confirmRemoveCharacter = async (
    store: ChapterGraphStore,
    characterId: string
) => {
    const summary = store.removeCharacterSummary(characterId);
    const ok = await modals.confirm({
        title: _('Remove %s', summary.name),
        message: summary.message,
        danger: true,
        confirmLabel: _('Remove'),
    });
    if (!ok) return;
    try {
        await store.removeCharacter(characterId);
    } catch (e) {
        if (e instanceof ReferencedError) {
            showReferences(
                _('%s is still referenced', summary.name),
                _(
                    'Nothing was deleted. These places still link to passages of %s:',
                    summary.name
                ),
                e.references
            );
        } else {
            await modals.alert(
                errorMessage(e),
                _('Could not remove %s', summary.name)
            );
        }
    }
};

export const openAddPassage = (store: ChapterGraphStore) =>
    modals.open((close) => (
        <AddPassageDialog
            store={store}
            onClose={close}
            onAddCharacter={(onAdded) => openAddCharacter(store, onAdded)}
        />
    ));

export const linkedPassageCreator = (
    store: ChapterGraphStore,
    characterId: string
): TPassageCreator => {
    const idPrefix = passageIdPrefix(store.chapterId, characterId);
    return {
        idPrefix,
        create: async (localId) => {
            try {
                await store.addPassage({ characterId, localId, type: 'screen' });
                return true;
            } catch (e) {
                await modals.alert(
                    errorMessage(e),
                    _('Could not create %s', idPrefix + localId)
                );
                return false;
            }
        },
    };
};

export const confirmDeletePassage = async (
    store: ChapterGraphStore,
    passageId: string | null = store.selectedId
) => {
    if (!passageId) return;
    const ok = await modals.confirm({
        title: _('Delete passage'),
        message: _('Delete %s? Its file is removed.', passageId),
        danger: true,
    });
    if (!ok) return;
    try {
        await store.deletePassage(passageId);
    } catch (e) {
        if (e instanceof ReferencedError) {
            showReferences(
                _('%s is still referenced', passageId),
                _('Nothing was deleted. These places still link to it:'),
                e.references
            );
        } else {
            await modals.alert(
                errorMessage(e),
                _('Could not delete %s', passageId)
            );
        }
    }
};

export const openChapterInfoDialog = (chapterId: string, api: TVisualizerApi) =>
    modals.open((close) => (
        <ChapterInfoDialog
            chapterId={chapterId}
            api={api}
            structure={structureStore}
            entities={entityStore}
            onClose={close}
        />
    ));
