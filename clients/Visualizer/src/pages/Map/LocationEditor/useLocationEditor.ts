import { useEffect, useState } from 'react';
import type { TLocationDto } from '@story/protocol';
import type { MapPageStore } from '../MapPageStore';
import { LocationEditorStore } from './LocationEditorStore';

export const useLocationEditor = (store: MapPageStore, location: TLocationDto) => {
    const [editor] = useState(
        () => new LocationEditorStore(location, (patch, version) => store.saveLocation(location.id, patch, version))
    );
    useEffect(() => editor.onExternal(location), [editor, location]);
    return editor;
};
