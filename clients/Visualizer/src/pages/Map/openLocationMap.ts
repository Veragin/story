import { router } from '../../shell';
import { askMapSize } from './mapDialogs';
import type { MapPageStore } from './MapPageStore';
import { mapRoute } from './mapRoute';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const addLocationMap = async (store: MapPageStore, id: string): Promise<boolean> => {
    const size = await askMapSize(store.locationName(id));
    if (!size) return false;
    try {
        await store.createLocationMap(id, size);
        return true;
    } catch (e) {
        store.setNotice({
            kind: 'error',
            text: _('Could not add the map: %s', errorText(e)),
        });
        return false;
    }
};

export const openLocationMap = async (store: MapPageStore, id: string) => {
    let version: string | null | undefined;
    try {
        version = store.locationMaps.has(id) ? store.locationMaps.get(id) : await store.fetchLocationMap(id);
    } catch (e) {
        store.setNotice({ kind: 'error', text: _('Could not open the map: %s', errorText(e)) });
        return;
    }
    if (version === null && !(await addLocationMap(store, id))) return;
    router.navigate(mapRoute(id));
};
