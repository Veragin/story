import type { ReactNode } from 'react';
import {
    Button,
    Chip,
    List,
    ListItemButton,
    ListItemText,
    ListSubheader,
    styled,
    Tooltip,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import FiberManualRecord from '@mui/icons-material/FiberManualRecord';
import { spacingCss } from '@story/ui';

export type TSideMenuEntry = {
    name: string;
    label?: string;
    secondary?: string;
    href: string;
    selected: boolean;
    unsaved?: boolean;
    chip?: string;
};

export type TSideMenuGroup = {
    title: string;
    entries: TSideMenuEntry[];
    onNew?: () => void;
    newAction?: string;
};

type TProps = {
    groups: TSideMenuGroup[];
    header?: ReactNode;
};

export const SideMenu = ({ groups, header }: TProps) => (
    <SColumn>
        {header}
        <SList dense>
            {groups.map((group) => (
                <li key={group.title} data-group={group.title}>
                    <ul>
                        <SSubheader>
                            <span>{group.title}</span>
                            {group.onNew && (
                                <Button
                                    size="small"
                                    startIcon={<Add fontSize="small" />}
                                    onClick={group.onNew}
                                    data-action={group.newAction}
                                >
                                    {_('New')}
                                </Button>
                            )}
                        </SSubheader>
                        {group.entries.map((entry) => (
                            <ListItemButton
                                key={entry.name}
                                component="a"
                                href={entry.href}
                                selected={entry.selected}
                                data-name={entry.name}
                            >
                                <ListItemText
                                    primary={entry.label ?? entry.name}
                                    secondary={entry.secondary}
                                    secondaryTypographyProps={{ noWrap: true }}
                                />
                                {entry.chip && (
                                    <Chip
                                        size="small"
                                        variant="outlined"
                                        label={entry.chip}
                                        data-chip={entry.chip}
                                    />
                                )}
                                {entry.unsaved && (
                                    <Tooltip title={_('Unsaved changes')}>
                                        <FiberManualRecord
                                            color="warning"
                                            sx={{ fontSize: 10, ml: 1 }}
                                        />
                                    </Tooltip>
                                )}
                            </ListItemButton>
                        ))}
                        {group.entries.length === 0 && (
                            <SEmpty>{_('None yet.')}</SEmpty>
                        )}
                    </ul>
                </li>
            ))}
        </SList>
    </SColumn>
);

const SColumn = styled('div')`
    display: flex;
    flex-direction: column;
    width: 260px;
    flex: 0 0 260px;
    min-height: 0;
    border-right: 1px solid ${({ theme }) => theme.palette.divider};
    background: ${({ theme }) => theme.palette.background.paper};
`;

const SList = styled(List)`
    flex: 1;
    overflow: auto;
    padding: 0;
    & ul {
        padding: 0;
    }
    & > li + li {
        border-top: 1px solid ${({ theme }) => theme.palette.divider};
    }
`;

const SSubheader = styled(ListSubheader)`
    display: flex;
    align-items: center;
    justify-content: space-between;
    line-height: 36px;
    background: ${({ theme }) => theme.palette.background.paper};
`;

const SEmpty = styled('li')`
    padding: ${spacingCss(0.5)} ${spacingCss(2)};
    font-size: 12px;
    color: ${({ theme }) => theme.palette.text.secondary};
`;
