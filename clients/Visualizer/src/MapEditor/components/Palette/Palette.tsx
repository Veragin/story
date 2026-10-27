import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { MapStore } from '../../MapStore';
import { ColorPicker } from './ColorPicker';
import { AddNewColor } from './AddNewColor';
import { DeleteAlert } from './DeleteAlert';

type Props = {
    mapStore: MapStore;
};

export const Palette = observer(({ mapStore }: Props) => {
    const [addNewColor, setAddNewColor] = useState<null | undefined | string>(
        null
    );
    const [addDeleteColor, setDeleteColor] = useState(false);

    if (!mapStore.data) return null;

    if (addNewColor !== null) {
        return (
            <AddNewColor
                mapStore={mapStore}
                onBack={() => setAddNewColor(null)}
                initId={addNewColor}
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
            onAddNewColor={(id) => setAddNewColor(id)}
            onDeleteColor={() => setDeleteColor(true)}
        />
    );
});
