import { useEffect, useState } from 'react';
import { errorMessage, type TStoryImageFile, type TVisualizerApi } from '../../api';

type TImageFiles = { files: readonly TStoryImageFile[] | null; error: string | null };

const NOT_LOADED: TImageFiles = { files: null, error: null };

export const useImageFiles = (api: TVisualizerApi, enabled: boolean): TImageFiles => {
    const [state, setState] = useState<TImageFiles>(NOT_LOADED);

    useEffect(() => {
        if (!enabled) return;
        let alive = true;
        setState(NOT_LOADED);
        const load = async () => {
            try {
                const files = await api.listImageFiles();
                if (alive) setState({ files, error: null });
            } catch (e) {
                if (alive) setState({ files: [], error: errorMessage(e) });
            }
        };
        void load();
        return () => {
            alive = false;
        };
    }, [api, enabled]);

    return state;
};
