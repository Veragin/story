import { useEffect } from 'react';
import { styled, Tab, Tabs } from '@mui/material';
import { capitalize } from '@story/shared';
import { observer } from 'mobx-react-lite';
import type { TEntityKind } from '@story/visualizer-protocol';
import { apiEvents } from '../../api';
import { entityStore, structureStore } from '../../context';
import { PageContainer, router } from '../../shell';
import { CatalogEntryForm } from './CatalogEntryForm';
import { CatalogFormStore } from './CatalogFormStore';
import { CatalogList } from './CatalogList';
import { EntityFormStore } from './EntityFormStore';
import { EntityForm } from './EntityForm';
import { EntityList } from './EntityList';

type Props = {
    kind?: TEntityKind;
    catalog?: string;
    id?: string;
};

const KINDS: { kind: TEntityKind; label: () => string }[] = [
    { kind: 'characters', label: () => _('Characters') },
    { kind: 'locations', label: () => _('Locations') },
    { kind: 'npcs', label: () => _('NPCs') },
    { kind: 'items', label: () => _('Items') },
];

let store: EntityFormStore | null = null;
let catalogStore: CatalogFormStore | null = null;

// module-level so switching tabs keeps the selection and drafts
const getEntityFormStore = () =>
    (store ??= new EntityFormStore({
        entities: entityStore,
        events: apiEvents,
    }));

const getCatalogFormStore = () =>
    (catalogStore ??= new CatalogFormStore({
        entities: entityStore,
        events: apiEvents,
    }));

const catalogTab = (catalog: string) => `catalog:${catalog}`;

export const EntitiesPage = observer(({ kind, catalog, id }: Props) => {
    const s = getEntityFormStore();
    const c = getCatalogFormStore();

    useEffect(() => {
        const releaseStructure = structureStore.start();
        const dispose = s.start();
        const disposeCatalogs = c.start();
        void s.refreshSelected();
        void c.refreshSelected();
        return () => {
            disposeCatalogs();
            dispose();
            releaseStructure();
        };
    }, [s, c]);

    useEffect(() => {
        if (catalog) {
            void c.show(catalog, id);
            return;
        }
        if (!kind) {
            router.navigate(
                { page: 'entities', kind: s.kind, id: s.lastIdOf(s.kind) },
                { replace: true }
            );
            return;
        }
        void s.show(kind, id);
    }, [s, c, kind, catalog, id]);

    const current = catalog ? catalogTab(catalog) : (kind ?? s.kind);
    const catalogType = structureStore.types.find(
        (type) => type.catalog?.name === catalog
    );
    const tabs = [
        ...KINDS.map((k) => ({
            value: k.kind,
            label: k.label(),
            href: router.href({
                page: 'entities',
                kind: k.kind,
                id: s.lastIdOf(k.kind),
            }),
        })),
        ...structureStore.types.flatMap(({ catalog: ref }) =>
            ref
                ? [
                      {
                          value: catalogTab(ref.name),
                          label: capitalize(ref.name),
                          href: router.href({
                              page: 'catalog',
                              catalog: ref.name,
                              id: c.lastIdOf(ref.name),
                          }),
                      },
                  ]
                : []
        ),
    ];

    return (
        <PageContainer>
            <SPage>
                <SKinds
                    value={
                        tabs.some((tab) => tab.value === current)
                            ? current
                            : false
                    }
                    textColor="inherit"
                    indicatorColor="primary"
                >
                    {tabs.map((tab) => (
                        <Tab
                            key={tab.value}
                            value={tab.value}
                            label={tab.label}
                            href={tab.href}
                        />
                    ))}
                </SKinds>
                {catalog ? (
                    <SBody>
                        <CatalogList
                            store={c}
                            structure={structureStore}
                            catalog={catalog}
                            type={catalogType}
                        />
                        <SFormArea>
                            <CatalogEntryForm store={c} type={catalogType} />
                        </SFormArea>
                    </SBody>
                ) : (
                    <SBody>
                        <EntityList store={s} structure={structureStore} />
                        <SFormArea>
                            <EntityForm store={s} structure={structureStore} />
                        </SFormArea>
                    </SBody>
                )}
            </SPage>
        </PageContainer>
    );
});

const SPage = styled('div')`
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    color: ${({ theme }) => theme.palette.text.primary};
    background: ${({ theme }) => theme.palette.background.default};
`;

const SKinds = styled(Tabs)`
    flex: 0 0 auto;
    min-height: 40px;
    border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
    background: ${({ theme }) => theme.palette.background.paper};
    & .MuiTab-root {
        min-height: 40px;
        text-transform: none;
    }
`;

const SBody = styled('div')`
    display: flex;
    flex: 1;
    min-height: 0;
`;

const SFormArea = styled('div')`
    flex: 1;
    min-width: 0;
    overflow: auto;
`;
