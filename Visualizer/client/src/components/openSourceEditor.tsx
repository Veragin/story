import { lazy, Suspense } from 'react';
import type { TSourceOwner } from '@story/visualizer-protocol';
import type { ApiEvents, TVisualizerApi } from '../api';
import { modals } from '../shell';

// lazy: CodeMirror is heavy and rarely opened
const SourceEditorDialog = lazy(async () => ({
    default: (await import('./SourceEditorDialog')).SourceEditorDialog,
}));

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
