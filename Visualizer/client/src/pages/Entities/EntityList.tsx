import {
    Alert,
    Button,
    CircularProgress,
    List,
    ListItemButton,
    ListItemText,
    styled,
    Tooltip,
} from '@mui/material';
import { Add, FiberManualRecord } from '@mui/icons-material';
import { observer } from 'mobx-react-lite';
import { spacingCss } from '@story/ui';
import { modals, router } from '../../shell';
import { CreateEntityDialog } from './CreateEntityDialog';
import type { EntitiesStore } from './EntitiesStore';
import { displayName } from './entityFields';

/** The left column: the entities of the selected kind, and "Add". */
export const EntityList = observer(({ store }: { store: EntitiesStore }) => {
    const { kind } = store;

    const add = () =>
        modals.open((close) => (
            <CreateEntityDialog
                kind={kind}
                store={store}
                onCancel={close}
                onCreated={(entity) => {
                    close();
                    router.navigate({ page: 'entities', kind, id: entity.id });
                }}
            />
        ));

    return (
        <SColumn>
            <SHead>
                <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={add}
                >
                    {_('Add')}
                </Button>
            </SHead>
            {store.listError && (
                <Alert severity="error" sx={{ m: 1 }}>
                    {store.listError}
                </Alert>
            )}
            {store.listLoading && store.list.length === 0 && (
                <SCenter>
                    <CircularProgress size={20} />
                </SCenter>
            )}
            <SList dense>
                {store.list.map((e) => {
                    const name = displayName(
                        (e as { name?: unknown }).name,
                        e.id
                    );
                    return (
                        <ListItemButton
                            key={e.id}
                            component="a"
                            href={router.href({
                                page: 'entities',
                                kind,
                                id: e.id,
                            })}
                            selected={store.selectedId === e.id}
                        >
                            <ListItemText
                                primary={name}
                                secondary={name !== e.id ? e.id : undefined}
                            />
                            {store.hasDraft(kind, e.id) && (
                                <Tooltip title={_('Unsaved changes')}>
                                    <FiberManualRecord
                                        color="warning"
                                        sx={{ fontSize: 10 }}
                                    />
                                </Tooltip>
                            )}
                        </ListItemButton>
                    );
                })}
                {!store.listLoading &&
                    !store.listError &&
                    store.list.length === 0 && (
                        <SEmpty>{_('Nothing here yet.')}</SEmpty>
                    )}
            </SList>
        </SColumn>
    );
});

const SColumn = styled('div')`
    display: flex;
    flex-direction: column;
    width: 240px;
    flex: 0 0 240px;
    min-height: 0;
    border-right: 1px solid ${({ theme }) => theme.palette.divider};
    background: ${({ theme }) => theme.palette.background.paper};
`;

const SHead = styled('div')`
    padding: ${spacingCss(1)};
    border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
`;

const SList = styled(List)`
    flex: 1;
    overflow: auto;
    padding: 0;
`;

const SCenter = styled('div')`
    display: flex;
    justify-content: center;
    padding: ${spacingCss(2)};
`;

const SEmpty = styled('div')`
    padding: ${spacingCss(2)};
    font-size: 13px;
    color: ${({ theme }) => theme.palette.text.secondary};
`;
