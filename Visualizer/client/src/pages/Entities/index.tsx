import { useEffect } from 'react';
import { styled, Tab, Tabs } from '@mui/material';
import { observer } from 'mobx-react-lite';
import type { TEntityKind } from '@story/visualizer-protocol';
import { api, apiEvents } from '../../api';
import { PageContainer, router } from '../../shell';
import { EntitiesStore } from './EntitiesStore';
import { EntityForm } from './EntityForm';
import { EntityList } from './EntityList';

type Props = {
    kind?: TEntityKind;
    id?: string;
};

const KINDS: { kind: TEntityKind; label: () => string }[] = [
    { kind: 'characters', label: () => _('Characters') },
    { kind: 'locations', label: () => _('Locations') },
    { kind: 'npcs', label: () => _('NPCs') },
    { kind: 'items', label: () => _('Items') },
];

let store: EntitiesStore | null = null;

// module-level so switching tabs keeps lists and drafts
const getEntitiesStore = () =>
    (store ??= new EntitiesStore({ api, events: apiEvents }));

export const EntitiesPage = observer(({ kind, id }: Props) => {
    const s = getEntitiesStore();

    useEffect(() => {
        const hadData = Object.keys(s.lists).length > 0;
        const dispose = s.start();
        if (hadData) void s.refreshAll();
        return dispose;
    }, [s]);

    useEffect(() => {
        if (!kind) {
            router.navigate(
                { page: 'entities', kind: s.kind, id: s.lastIdOf(s.kind) },
                { replace: true }
            );
            return;
        }
        void s.show(kind, id);
    }, [s, kind, id]);

    const current = kind ?? s.kind;

    return (
        <PageContainer>
            <SPage>
                <SKinds
                    value={current}
                    textColor="inherit"
                    indicatorColor="primary"
                >
                    {KINDS.map((k) => (
                        <Tab
                            key={k.kind}
                            value={k.kind}
                            label={k.label()}
                            href={router.href({
                                page: 'entities',
                                kind: k.kind,
                                id: s.lastIdOf(k.kind),
                            })}
                        />
                    ))}
                </SKinds>
                <SBody>
                    <EntityList store={s} />
                    <SFormArea>
                        <EntityForm store={s} />
                    </SFormArea>
                </SBody>
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
