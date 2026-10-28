import { observer } from 'mobx-react-lite';
import { SideMenu } from '../../components/layout/SideMenu';
import { router } from '../../shell';
import type { StructureStore } from '../../stores/StructureStore';
import { openCreateEntity } from './entityDialogs';
import type { EntityFormStore } from './EntityFormStore';
import { displayName } from './entityFields';

type TProps = {
    store: EntityFormStore;
    structure: StructureStore;
    title: string;
};

export const EntityList = observer(({ store, structure, title }: TProps) => {
    const { kind } = store;

    const add = () => openCreateEntity(kind, store.entities, structure);

    const { listError } = store.entities;

    return (
        <SideMenu
            loading={store.entities.listLoading}
            loadError={
                listError
                    ? {
                          message: listError,
                          retry: () => void store.entities.loadList(kind),
                      }
                    : null
            }
            groups={[
                {
                    title,
                    onNew: add,
                    newAction: 'new-entity',
                    entries: store.list.map((e) => ({
                        name: e.id,
                        label: displayName(e.name, e.id),
                        href: router.href({
                            page: 'entities',
                            kind,
                            id: e.id,
                        }),
                        selected: store.selectedId === e.id,
                        unsaved: store.hasDraft(kind, e.id),
                    })),
                },
            ]}
        />
    );
});
