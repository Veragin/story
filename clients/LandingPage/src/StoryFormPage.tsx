import type { ReactNode } from 'react';
import {
    Alert,
    Box,
    Button,
    Container,
    Stack,
    Typography,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';

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
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}
        >
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
        </Stack>
        <Container maxWidth="sm" sx={{ flex: 1, py: 3 }}>
            {notice}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}
            {children}
        </Container>
        <Box
            sx={{
                position: 'sticky',
                bottom: 0,
                bgcolor: 'background.paper',
                borderTop: 1,
                borderColor: 'divider',
            }}
        >
            <Container maxWidth="sm">
                <Stack
                    direction="row"
                    spacing={1}
                    justifyContent="flex-end"
                    sx={{ py: 1.5 }}
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
                </Stack>
            </Container>
        </Box>
    </Box>
);
