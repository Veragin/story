import type { TServerContext } from '../context';
import { findCatalog, findCatalogEntry, listCatalog, readCatalogEntry } from '../project/readers/catalogs';
import { SourceProject } from '../project/SourceProject';
import {
    catalogEntryDeleteReferences,
    createCatalogEntry,
    deleteCatalogEntry,
    updateCatalogEntry,
} from '../project/writers/catalogs';

export const registerCatalogRoutes = ({ router, project, bus }: TServerContext) => {
    const sp = SourceProject.for(project);
    const w = { sp, bus };
    router
        .handle('listCatalogEntries', ({ params }) => sp.run(() => listCatalog(sp, params.name)))
        .handle('createCatalogEntry', ({ params, body }) => createCatalogEntry(w, params.name, body))
        .handle('getCatalogEntry', ({ params }) =>
            sp.run(() => readCatalogEntry(sp, findCatalogEntry(sp, findCatalog(sp, params.name), params.id)))
        )
        .handle('updateCatalogEntry', ({ params, body }) => updateCatalogEntry(w, params.name, params.id, body))
        .handle('deleteCatalogEntry', ({ params, body }) => deleteCatalogEntry(w, params.name, params.id, body))
        .handle('getCatalogEntryReferences', ({ params }) => catalogEntryDeleteReferences(sp, params.name, params.id));
};
