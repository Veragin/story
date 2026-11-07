import { Chip, ListItemButton, ListItemText, styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import { AddButton } from '../buttons/AddButton';
import { UnsavedIndicator } from './UnsavedIndicator';

export type TSideMenuAction = {
    label: string;
    action: string;
    onClick: () => void;
};

export type TSideMenuEntry = {
    name: string;
    label?: string;
    secondary?: string;
    href: string;
    selected: boolean;
    unsaved?: boolean;
    chip?: string;
    nested?: TSideMenuEntry[];
    actions?: TSideMenuAction[];
};

type TProps = {
    entry: TSideMenuEntry;
    depth?: number;
};

export const SideMenuEntry = ({ entry, depth = 0 }: TProps) => {
    const nested = entry.nested ?? [];
    const actions = entry.actions ?? [];
    return (
        <>
            <ListItemButton
                component="a"
                href={entry.href}
                selected={entry.selected}
                data-name={entry.name}
                data-depth={depth}
                sx={{ pl: indent(depth) }}
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
                {entry.unsaved && <UnsavedIndicator variant="dot" />}
            </ListItemButton>
            {nested.map((child) => (
                <SideMenuEntry
                    key={child.name}
                    entry={child}
                    depth={depth + 1}
                />
            ))}
            {actions.length > 0 && (
                <SActions depth={depth + 1} data-actions-of={entry.name}>
                    {actions.map((action) => (
                        <AddButton
                            key={action.action}
                            label={action.label}
                            onClick={action.onClick}
                            data-action={action.action}
                        />
                    ))}
                </SActions>
            )}
        </>
    );
};

const indent = (depth: number) => spacingCss(2 + depth * 2);

const SActions = styled('li', {
    shouldForwardProp: (prop) => prop !== 'depth',
})<{ depth: number }>`
    display: flex;
    flex-wrap: wrap;
    gap: ${spacingCss(0.5)};
    padding-left: ${({ depth }) => indent(depth)};
`;
