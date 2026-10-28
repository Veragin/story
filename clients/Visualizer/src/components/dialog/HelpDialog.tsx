import type { ReactNode } from 'react';
import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import { AppDialog } from './AppDialog';
import { DialogButtons } from './DialogButtons';

type TProps = {
    title: string;
    onClose: () => void;
    children: ReactNode;
};

export const HelpDialog = ({ title, onClose, children }: TProps) => (
    <AppDialog
        title={title}
        size="sm"
        onClose={onClose}
        actions={<DialogButtons closeOnly onClose={onClose} />}
    >
        <SHelp>{children}</SHelp>
    </AppDialog>
);

const SHelp = styled('div')`
    color: ${({ theme }) => theme.palette.text.primary};
    line-height: 1.5;
    & h4 {
        margin: ${spacingCss(1)} 0 0;
    }
    & h4:first-of-type {
        margin-top: 0;
    }
    & ul,
    & p {
        margin: ${spacingCss(0.5)} 0;
    }
`;
