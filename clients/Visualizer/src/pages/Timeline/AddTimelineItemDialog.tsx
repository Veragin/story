import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ApiError, errorMessage } from '../../api';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { useDialogSubmit } from '../../components/dialog/useDialogSubmit';
import { FormAutocompleteInput } from '../../components/form/FormAutocompleteInput';
import { FormRadioInput } from '../../components/form/FormRadioInput';
import { FormTextInput } from '../../components/form/FormTextInput';
import type { TimelineStore } from './store/TimelineStore';

// ids end up in identifiers and passage ids (`<chapter>-<character>-<local>`)
const ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;

type TKind = 'chapter' | 'trigger';

const isKind = (value: string): value is TKind =>
    value === 'chapter' || value === 'trigger';

const addError = (e: unknown) =>
    e instanceof ApiError && e.code === 'exists'
        ? _('This id is taken')
        : errorMessage(e);

type TProps = {
    store: TimelineStore;
    time: number;
    onClose: () => void;
};

export const AddTimelineItemDialog = observer(
    ({ store, time, onClose }: TProps) => {
        const chapters = store.chapterIds;
        const locations = store.project?.locations ?? [];
        const selectedChapter =
            store.selected?.kind === 'chapter' ? store.selected.id : undefined;
        const [kind, setKind] = useState<TKind>('chapter');
        const [id, setId] = useState('');
        const [chapterId, setChapterId] = useState(
            selectedChapter ?? chapters[0] ?? ''
        );
        const [location, setLocation] = useState(locations[0]?.id ?? '');

        const idTaken =
            kind === 'chapter'
                ? store.chapters.has(id)
                : store.triggers.has(id);
        const idError =
            id === ''
                ? null
                : !ID_PATTERN.test(id)
                  ? _('Letters and digits only, starting with a letter')
                  : idTaken
                    ? _('This id is taken')
                    : null;
        const valid =
            id !== '' &&
            !idError &&
            (kind === 'chapter' ? location !== '' : chapterId !== '');

        const { busy, error, submit } = useDialogSubmit(
            async () => {
                if (kind === 'chapter')
                    await store.createChapter({
                        chapterId: id,
                        location,
                        start: time,
                    });
                else
                    await store.createTrigger({
                        chapterId,
                        triggerId: id,
                        time,
                    });
                onClose();
            },
            { canSubmit: valid, toError: addError }
        );

        return (
            <AppDialog
                title={_('Add to the timeline')}
                size="xs"
                onClose={onClose}
                onSubmit={submit}
                error={error}
                actions={
                    <DialogButtons
                        onClose={onClose}
                        label={_('Add')}
                        busyLabel={_('Adding…')}
                        busy={busy}
                        disabled={!valid}
                        submit
                    />
                }
            >
                <FormRadioInput
                    label={_('Kind')}
                    row
                    value={kind}
                    onChange={(next = 'chapter') => {
                        if (isKind(next)) setKind(next);
                    }}
                    options={[
                        { id: 'chapter', label: _('Chapter') },
                        { id: 'trigger', label: _('Time trigger') },
                    ]}
                    dataField="kind"
                />
                <FormTextInput
                    autoFocus
                    label={
                        kind === 'chapter' ? _('Chapter id') : _('Trigger id')
                    }
                    value={id}
                    onChange={(next = '') => setId(next.trim())}
                    error={idError}
                    dataField="id"
                />
                {kind === 'chapter' ? (
                    <FormAutocompleteInput
                        label={_('Location')}
                        value={location}
                        onChange={(next) => setLocation(next ?? '')}
                        options={locations.map((l) => ({
                            id: l.id,
                            label: l.name,
                        }))}
                        dataField="location"
                    />
                ) : (
                    <FormAutocompleteInput
                        label={_('Chapter')}
                        value={chapterId}
                        onChange={(next) => setChapterId(next ?? '')}
                        options={chapters.map((c) => ({
                            id: c,
                            label: store.chapterTitle(c),
                        }))}
                        dataField="chapterId"
                    />
                )}
            </AppDialog>
        );
    }
);
