import type { TEngineSettings, TTopbarProps } from '@story/types';
import { observer } from 'mobx-react-lite';
import { useEffect, useReducer, type FunctionComponent } from 'react';

type TLoadTopbar = NonNullable<TEngineSettings['Topbar']>;

export type TTopbarComponent = FunctionComponent<TTopbarProps>;

// keyed by the story's own loader function, so each story loads its Topbar once
const loaded = new WeakMap<TLoadTopbar, TTopbarComponent>();
const loading = new WeakMap<TLoadTopbar, Promise<TTopbarComponent>>();

const loadTopbar = (load: TLoadTopbar): Promise<TTopbarComponent> => {
    const pending = loading.get(load);
    if (pending) return pending;
    const next = (async () => {
        const { Topbar } = await load();
        const component = observer(Topbar);
        loaded.set(load, component);
        return component;
    })();
    loading.set(load, next);
    return next;
};

export const useStoryTopbar = (load: TLoadTopbar | undefined): TTopbarComponent | null => {
    const [, rerender] = useReducer((n: number) => n + 1, 0);

    useEffect(() => {
        if (load === undefined || loaded.has(load)) return;
        let mounted = true;
        const run = async () => {
            try {
                await loadTopbar(load);
                if (mounted) rerender();
            } catch (error) {
                console.error("The story's Topbar failed to load", error);
            }
        };
        void run();
        return () => {
            mounted = false;
        };
    }, [load]);

    return load === undefined ? null : (loaded.get(load) ?? null);
};
