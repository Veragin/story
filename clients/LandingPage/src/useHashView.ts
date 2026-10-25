import { useEffect, useState } from 'react';

export type TView = 'list' | 'new';

const NEW_STORY_HASH = '#/new';

const viewOf = (hash: string): TView => (hash === NEW_STORY_HASH ? 'new' : 'list');

export const useHashView = () => {
    const [view, setView] = useState(() => viewOf(window.location.hash));

    useEffect(() => {
        const sync = () => setView(viewOf(window.location.hash));
        window.addEventListener('popstate', sync);
        window.addEventListener('hashchange', sync);
        return () => {
            window.removeEventListener('popstate', sync);
            window.removeEventListener('hashchange', sync);
        };
    }, []);

    const navigate = (next: TView) => {
        const { pathname, search } = window.location;
        window.history.pushState(null, '', next === 'new' ? NEW_STORY_HASH : pathname + search);
        setView(next);
    };

    return { view, navigate };
};
