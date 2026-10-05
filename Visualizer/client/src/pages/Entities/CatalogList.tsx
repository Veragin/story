import { observer } from 'mobx-react-lite';
import type { TStructTypeDto } from '@story/visualizer-protocol';
import { modals, router } from '../../shell';
import type { StructureStore } from '../../stores/StructureStore';
import type { CatalogFormStore } from './CatalogFormStore';
import { CreateCatalogEntryDialog } from './CreateCatalogEntryDialog';
import { displayName } from './entityFields';
import { ResourceList } from './ResourceList';

type TProps = {
    store: CatalogFormStore;
    structure: StructureStore;
    catalog: string;
    type: TStructTypeDto | undefined;
};

export const CatalogList = observer(
    ({ store, structure, catalog, type }: TProps) => {
        const add = () => {
            if (!type) return;
            modals.open((close) => (
                <CreateCatalogEntryDialog
                    type={type}
                    catalog={catalog}
                    entities={store.entities}
                    structure={structure}
                    onCancel={close}
                    onCreated={(entry) => {
                        close();
                        router.navigate({
                            page: 'catalog',
                            catalog,
                            id: entry.id,
                        });
                    }}
                />
            ));
        };

        return (
            <ResourceList
                onAdd={add}
                items={store.list.map((entry) => {
                    const name = displayName(entry.values.name, entry.id);
                    return {
                        id: entry.id,
                        primary: name,
                        secondary: name !== entry.id ? entry.id : undefined,
                        href: router.href({
                            page: 'catalog',
                            catalog,
                            id: entry.id,
                        }),
                        selected: store.selectedId === entry.id,
                    };
                })}
            />
        );
    }
);
