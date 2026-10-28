import { observer } from 'mobx-react-lite';
import type { TStructTypeDto } from '@story/protocol';
import { capitalize } from '@story/shared';
import { SideMenu } from '../../components/layout/SideMenu';
import { router } from '../../shell';
import type { StructureStore } from '../../stores/StructureStore';
import type { CatalogFormStore } from './CatalogFormStore';
import { openCreateCatalogEntry } from './entityDialogs';
import { displayName } from './entityFields';

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
            openCreateCatalogEntry(type, catalog, store.entities, structure);
        };

        return (
            <SideMenu
                groups={[
                    {
                        title: capitalize(catalog),
                        onNew: add,
                        newAction: 'new-catalog-entry',
                        entries: store.list.map((entry) => ({
                            name: entry.id,
                            label: displayName(entry.values.name, entry.id),
                            href: router.href({
                                page: 'catalog',
                                catalog,
                                id: entry.id,
                            }),
                            selected: store.selectedId === entry.id,
                        })),
                    },
                ]}
            />
        );
    }
);
