import { observer } from 'mobx-react-lite';
import { modals, router } from '../../shell';
import type { StructureStore } from '../../stores/StructureStore';
import { CreateEntityDialog } from './CreateEntityDialog';
import type { EntityFormStore } from './EntityFormStore';
import { displayName } from './entityFields';
import { ResourceList } from './ResourceList';

type TProps = {
    store: EntityFormStore;
    structure: StructureStore;
};

export const EntityList = observer(({ store, structure }: TProps) => {
    const { kind } = store;

    const add = () =>
        modals.open((close) => (
            <CreateEntityDialog
                kind={kind}
                entities={store.entities}
                structure={structure}
                onCancel={close}
                onCreated={(entity) => {
                    close();
                    router.navigate({ page: 'entities', kind, id: entity.id });
                }}
            />
        ));

    return (
        <ResourceList
            onAdd={add}
            loading={store.entities.listLoading}
            error={store.entities.listError}
            items={store.list.map((e) => {
                const name = displayName(e.name, e.id);
                return {
                    id: e.id,
                    primary: name,
                    secondary: name !== e.id ? e.id : undefined,
                    href: router.href({ page: 'entities', kind, id: e.id }),
                    selected: store.selectedId === e.id,
                    unsaved: store.hasDraft(kind, e.id),
                };
            })}
        />
    );
});
