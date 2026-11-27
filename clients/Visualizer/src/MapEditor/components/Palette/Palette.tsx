import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { MapStore } from '../../MapStore';
import { ColorPicker } from './ColorPicker';
import { TileTypeForm } from './TileTypeForm';
import { DeleteAlert } from './DeleteAlert';

type TProps = {
    mapStore: MapStore;
};

export const Palette = observer(({ mapStore }: TProps) => {
    const [tileTypeForm, setTileTypeForm] = useState<null | undefined | string>(
        null
    );
    const [addDeleteColor, setDeleteColor] = useState(false);

    if (!mapStore.data) return null;

    if (tileTypeForm !== null) {
        return (
            <TileTypeForm
                mapStore={mapStore}
                onBack={() => setTileTypeForm(null)}
                editId={tileTypeForm}
            />
        );
    }
    if (addDeleteColor) {
        return (
            <DeleteAlert
                mapStore={mapStore}
                onBack={() => setDeleteColor(false)}
            />
        );
    }
    return (
        <ColorPicker
            mapStore={mapStore}
            onOpenTileTypeForm={(id) => setTileTypeForm(id)}
            onDeleteColor={() => setDeleteColor(true)}
        />
    );
});
