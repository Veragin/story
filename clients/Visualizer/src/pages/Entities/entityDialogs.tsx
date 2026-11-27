import type {
    TDeleteReferencesDto,
    TEntityKind,
    TStructTypeDto,
} from '@story/protocol';
import { modals, router } from '../../shell';
import type { StructureStore } from '../../stores/StructureStore';
import type { EntityStore } from '../../stores/EntityStore';
import { CreateCatalogEntryDialog } from './CreateCatalogEntryDialog';
import { CreateEntityDialog } from './CreateEntityDialog';
import { DeletePreviewDialog } from './DeletePreviewDialog';

type TConfirmDelete = {
    title: string;
    message: string;
    preview: () => Promise<TDeleteReferencesDto>;
};

export const confirmDelete = (options: TConfirmDelete): Promise<boolean> =>
    modals.ask<boolean>(
        (answer) => (
            <DeletePreviewDialog
                {...options}
                onDelete={() => answer(true)}
                onClose={() => answer(false)}
            />
        ),
        false
    );

export const openCreateEntity = (
    kind: TEntityKind,
    entities: EntityStore,
    structure: StructureStore
) =>
    modals.open((close) => (
        <CreateEntityDialog
            kind={kind}
            entities={entities}
            structure={structure}
            onClose={close}
            onCreated={(entity) => {
                close();
                router.navigate({ page: 'entities', kind, id: entity.id });
            }}
        />
    ));

export const openCreateCatalogEntry = (
    type: TStructTypeDto,
    catalog: string,
    entities: EntityStore,
    structure: StructureStore
) =>
    modals.open((close) => (
        <CreateCatalogEntryDialog
            type={type}
            catalog={catalog}
            entities={entities}
            structure={structure}
            onClose={close}
            onCreated={(entry) => {
                close();
                router.navigate({ page: 'catalog', catalog, id: entry.id });
            }}
        />
    ));
