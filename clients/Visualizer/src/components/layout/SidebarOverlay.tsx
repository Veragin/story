import { styled } from '@mui/material';

export const SidebarOverlay = styled('div')(({ theme }) => ({
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    width: 'min(340px, 90vw)',
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    color: theme.palette.text.primary,
    fontSize: theme.typography.small.fontSize,
    backgroundColor: theme.palette.surface.overlay,
    borderLeft: `1px solid ${theme.palette.border.strong}`,
}));
