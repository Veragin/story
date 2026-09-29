import { lazy, Suspense } from 'react';
import type { TSourceOwner } from '@story/visualizer-protocol';
import type { ApiEvents, TVisualizerApi } from '../api';
import { modals } from '../shell';

/** Loaded on first use: CodeMirror is most of its weight, and most sessions never open it. */
const SourceEditorDialog = lazy(async () => ({
    default: (await import('./SourceEditorDialog')).SourceEditorDialog,
}));

/** Open the source editor of a chapter or passage on the app's modal stack. */
export const openSourceEditor = (
    owner: TSourceOwner,
    id: string,
    api: TVisualizerApi,
    events?: ApiEvents
) =>
    modals.open((close) => (
        <Suspense fallback={null}>
            <SourceEditorDialog
                owner={owner}
                id={id}
                api={api}
                events={events}
                onClose={close}
            />
        </Suspense>
    ));
