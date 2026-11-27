import { Chip, ListItemButton, ListItemText } from '@mui/material';
import { UnsavedIndicator } from './UnsavedIndicator';

export type TSideMenuEntry = {
    name: string;
    label?: string;
    secondary?: string;
    href: string;
    selected: boolean;
    unsaved?: boolean;
    chip?: string;
};

type TProps = {
    entry: TSideMenuEntry;
};

export const SideMenuEntry = ({ entry }: TProps) => (
    <ListItemButton
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
        {entry.unsaved && <UnsavedIndicator variant="dot" />}
    </ListItemButton>
);
