import type { TReferenceDto } from '@story/visualizer-protocol';
import { modals } from '../../shell';
import { ReferencedError, type ChapterGraphStore } from './ChapterGraphStore';
import { AddCharacterDialog } from './AddCharacterDialog';
import { AddPassageDialog } from './AddPassageDialog';
import { PickCharacterDialog } from './PickCharacterDialog';
import { ReferencesDialog } from './ReferencesDialog';
import { errorText } from './dialogUtils';

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

export const openAddCharacter = (store: ChapterGraphStore) => {
    void store.refetchProject();
    modals.open((close) => (
        <AddCharacterDialog store={store} onClose={close} />
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
            await modals.confirm({
                title: _('Could not remove %s', summary.name),
                message: errorText(e),
            });
        }
    }
};

export const openRemoveCharacter = (store: ChapterGraphStore) =>
    modals.open((close) => (
        <PickCharacterDialog
            store={store}
            onClose={close}
            onPick={(id) => void confirmRemoveCharacter(store, id)}
        />
    ));

export const openAddPassage = (store: ChapterGraphStore) =>
    modals.open((close) => (
        <AddPassageDialog
            store={store}
            onClose={close}
            onAddCharacter={() => openAddCharacter(store)}
        />
    ));

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
            await modals.confirm({
                title: _('Could not delete %s', passageId),
                message: errorText(e),
            });
        }
    }
};
