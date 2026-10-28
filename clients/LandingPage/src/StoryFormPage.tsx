import type { ReactNode } from 'react';
import { Button, Container, Stack, styled, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { spacingCss, StackedAlert } from '@story/ui';

type TProps = {
    title: string;
    notice?: ReactNode;
    error?: string | null;
    children: ReactNode;
    saving: boolean;
    submitLabel: string;
    savingLabel: string;
    submitBlocked?: boolean;
    submitAction?: string;
    onSubmit: () => void;
    onClose: () => void;
};

export const StoryFormPage = ({
    title,
    notice,
    error = null,
    children,
    saving,
    submitLabel,
    savingLabel,
    submitBlocked = false,
    submitAction,
    onSubmit,
    onClose,
}: TProps) => (
    <SPage>
        <SHeader direction="row" spacing={2} alignItems="center">
            <Button
                color="inherit"
                startIcon={<ArrowBack />}
                onClick={onClose}
                disabled={saving}
                data-action="back"
            >
                {_('Back')}
            </Button>
            <Typography variant="h6" component="h1" noWrap>
                {title}
            </Typography>
        </SHeader>
        <SContent maxWidth="sm">
            {notice}
            {error && <StackedAlert severity="error">{error}</StackedAlert>}
            {children}
        </SContent>
        <SFooter>
            <Container maxWidth="sm">
                <SFooterActions
                    direction="row"
                    spacing={1}
                    justifyContent="flex-end"
                >
                    <Button color="inherit" onClick={onClose} disabled={saving}>
                        {_('Cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={onSubmit}
                        disabled={saving || submitBlocked}
                        data-action={submitAction}
                    >
                        {saving ? savingLabel : submitLabel}
                    </Button>
                </SFooterActions>
            </Container>
        </SFooter>
    </SPage>
);

const SPage = styled('div')`
    display: flex;
    flex-direction: column;
    min-height: 100%;
`;

const SHeader = styled(Stack)`
    padding: ${spacingCss(1)} ${spacingCss(2)};
    border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
`;

const SContent = styled(Container)`
    flex: 1;
    padding-top: ${spacingCss(3)};
    padding-bottom: ${spacingCss(3)};
`;

const SFooter = styled('div')`
    position: sticky;
    bottom: 0;
    background-color: ${({ theme }) => theme.palette.background.paper};
    border-top: 1px solid ${({ theme }) => theme.palette.divider};
`;

const SFooterActions = styled(Stack)`
    padding: ${spacingCss(1.5)} 0;
`;
