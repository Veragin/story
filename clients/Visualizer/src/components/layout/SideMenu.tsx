import type { ReactNode } from 'react';
import {
    Chip,
    List,
    ListItemButton,
    ListItemText,
    ListSubheader,
    styled,
} from '@mui/material';
import { spacingCss } from '@story/ui';
import { AddButton } from '../buttons/AddButton';
import { LoadErrorState } from '../feedback/LoadErrorState';
import { LoadingState } from '../feedback/LoadingState';
import { UnsavedIndicator } from './UnsavedIndicator';

const SIDE_MENU_WIDTH = 260;

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

type TSideMenuLoadError = {
    message: string;
    retry: () => void;
};

type TProps = {
    groups: TSideMenuGroup[];
    header?: ReactNode;
    loading?: boolean;
    loadError?: TSideMenuLoadError | null;
};

export const SideMenu = ({ groups, header, loading, loadError }: TProps) => {
    const showEmpty = !loading && !loadError;
    return (
        <SColumn>
            {header}
            {loadError && (
                <SStatus>
                    <LoadErrorState
                        message={loadError.message}
                        onRetry={loadError.retry}
                    />
                </SStatus>
            )}
            <SList dense>
                {groups.map((group) => (
                    <li key={group.title} data-group={group.title}>
                        <ul>
                            <SSubheader>
                                <span>{group.title}</span>
                                {group.onNew && (
                                    <AddButton
                                        label={_('New')}
                                        onClick={group.onNew}
                                        data-action={group.newAction}
                                    />
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
                                        secondaryTypographyProps={{
                                            noWrap: true,
                                        }}
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
                                        <UnsavedIndicator variant="dot" />
                                    )}
                                </ListItemButton>
                            ))}
                            {group.entries.length === 0 &&
                                (loading ? (
                                    <li>
                                        <LoadingState />
                                    </li>
                                ) : (
                                    showEmpty && (
                                        <SEmpty>{_('None yet.')}</SEmpty>
                                    )
                                ))}
                        </ul>
                    </li>
                ))}
            </SList>
        </SColumn>
    );
};

const SColumn = styled('div')`
    display: flex;
    flex-direction: column;
    width: ${SIDE_MENU_WIDTH}px;
    flex: 0 0 ${SIDE_MENU_WIDTH}px;
    min-height: 0;
    border-right: 1px solid ${({ theme }) => theme.palette.divider};
    background: ${({ theme }) => theme.palette.background.paper};
`;

const SStatus = styled('div')`
    padding: ${spacingCss(1)};
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
    font-size: ${({ theme }) => theme.typography.meta.fontSize};
    color: ${({ theme }) => theme.palette.text.secondary};
`;
