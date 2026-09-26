import { lazy, Suspense, useEffect } from 'react';
import { CircularProgress, styled } from '@mui/material';
import { Column } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { reaction } from 'mobx';
import { router, TRoute } from './router';
import { TopBar } from './TopBar';
import { ModalHost } from './ModalHost';
import { useVisualizerStore } from '../context';
import MapPage from '../pages/Map';
import TimelinePage from '../pages/Timeline';
import ChapterPage from '../pages/Chapter';
import EntitiesPage from '../pages/Entities';

/** Dev canvas playground (WP3), loaded lazily so it stays out of the main bundle. */
const CanvasPlayground = lazy(async () => ({
    default: (await import('../canvas/playground/CanvasPlayground'))
        .CanvasPlayground,
}));

const renderPage = (route: TRoute) => {
    switch (route.page) {
        case 'map':
            return <MapPage />;
        case 'timeline':
            return <TimelinePage />;
        case 'chapter':
            return (
                <ChapterPage
                    key={route.chapterId}
                    chapterId={route.chapterId}
                />
            );
        case 'entities':
            return <EntitiesPage kind={route.kind} id={route.id} />;
        case 'canvas':
            return <CanvasPlayground />;
    }
};

export const Shell = observer(() => {
    const store = useVisualizerStore();

    useEffect(() => {
        router.start();
        // the floating info panel belongs to the page that opened it
        const dispose = reaction(
            () => router.route,
            () => store.setModalContent(null)
        );
        return () => {
            dispose();
            router.stop();
        };
    }, [store]);

    return (
        <SRoot>
            <TopBar />
            <SPage>
                <Suspense fallback={<CircularProgress />}>
                    {renderPage(router.route)}
                </Suspense>
            </SPage>
            <ModalHost />
        </SRoot>
    );
});

const SRoot = styled(Column)`
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background-color: #000;
`;

/** Pages get the whole area under the top bar; they should fill it with `height: 100%`. */
const SPage = styled(Column)`
    flex: 1;
    min-height: 0;
    position: relative;
    overflow: hidden;
    align-items: stretch;
`;
