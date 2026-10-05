import { observer } from 'mobx-react-lite';
import type { TEntityDto } from '@story/visualizer-protocol';
import { CharacterFields } from './CharacterFields';
import type { TEntityFieldsProps } from './entityFormProps';
import { ItemFields } from './ItemFields';
import { LocationFields } from './LocationFields';
import { NpcFields } from './NpcFields';

export const EntityFields = observer(
    ({ draft, ...props }: TEntityFieldsProps<TEntityDto>) => {
        switch (draft.kind) {
            case 'characters':
                return <CharacterFields {...props} draft={draft} />;
            case 'npcs':
                return <NpcFields {...props} draft={draft} />;
            case 'locations':
                return <LocationFields {...props} draft={draft} />;
            case 'items':
                return <ItemFields {...props} draft={draft} />;
        }
    }
);
