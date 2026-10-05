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
import Add from '@mui/icons-material/Add';
import FiberManualRecord from '@mui/icons-material/FiberManualRecord';
import { spacingCss } from '@story/ui';

export type TResourceListItem = {
    id: string;
    primary: string;
    href: string;
    selected: boolean;
    unsaved?: boolean;
};

type TProps = {
    items: readonly TResourceListItem[];
    onAdd: () => void;
    loading?: boolean;
    error?: string | null;
};

export const ResourceList = ({ items, onAdd, loading, error }: TProps) => (
    <SColumn>
        <SHead>
            <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<Add />}
                onClick={onAdd}
                data-action="add-resource"
            >
                {_('Add')}
            </Button>
        </SHead>
        {error && (
            <Alert severity="error" sx={{ m: 1 }}>
                {error}
            </Alert>
        )}
        {loading && items.length === 0 && (
            <SCenter>
                <CircularProgress size={20} />
            </SCenter>
        )}
        <SList dense>
            {items.map((item) => (
                <ListItemButton
                    key={item.id}
                    component="a"
                    href={item.href}
                    selected={item.selected}
                    data-id={item.id}
                >
                    <ListItemText primary={item.primary} />
                    {item.unsaved && (
                        <Tooltip title={_('Unsaved changes')}>
                            <FiberManualRecord
                                color="warning"
                                sx={{ fontSize: 10 }}
                            />
                        </Tooltip>
                    )}
                </ListItemButton>
            ))}
            {!loading && !error && items.length === 0 && (
                <SEmpty>{_('Nothing here yet.')}</SEmpty>
            )}
        </SList>
    </SColumn>
);

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
