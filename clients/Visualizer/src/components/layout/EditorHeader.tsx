import type { ReactNode } from 'react';
import { Button, Chip, CircularProgress, Tooltip, styled } from '@mui/material';
import Restore from '@mui/icons-material/Restore';
import Save from '@mui/icons-material/Save';
import { observer } from 'mobx-react-lite';
import { spacingCss } from '@story/ui';
import { useKey } from '../../shell/keyboard';
import { DeleteButton } from '../buttons/DeleteButton';
import { UnsavedIndicator } from './UnsavedIndicator';

export interface IEditorSource {
    readonly dirty: boolean;
    readonly saving: boolean;
    readonly stale: unknown;
    discard(): void;
    save(): Promise<boolean>;
}

type TProps = {
    title: ReactNode;
    store: IEditorSource;
    chip?: string;
    subtitle?: ReactNode;
    actions?: ReactNode;
    onDelete?: () => void;
    deleteLabel?: string;
    deleteBlocker?: string;
    compact?: boolean;
};

export const EditorHeader = observer(
    ({
        title,
        store,
        chip,
        subtitle,
        actions,
        onDelete,
        deleteLabel,
        deleteBlocker,
        compact = false,
    }: TProps) => {
        const canSave = store.dirty && !store.saving && !store.stale;

        useKey(
            'mod+s',
            (e) => {
                e.preventDefault();
                if (canSave) void store.save();
                return true;
            },
            { allowInInputs: true }
        );

        const deleteButton = onDelete && (
            <DeleteButton
                label={deleteLabel}
                iconOnly={compact}
                tone="error"
                onClick={onDelete}
                disabled={store.saving || !!deleteBlocker}
                data-action="delete"
            />
        );

        const buttons = (
            <>
                <Tooltip title={_('Discard unsaved input')}>
                    <span>
                        <Button
                            size="small"
                            color="inherit"
                            startIcon={<Restore />}
                            disabled={!store.dirty || store.saving}
                            onClick={() => store.discard()}
                            data-action="discard"
                        >
                            {_('Discard')}
                        </Button>
                    </span>
                </Tooltip>
                {deleteButton &&
                    (deleteBlocker ? (
                        <Tooltip title={deleteBlocker}>
                            <span>{deleteButton}</span>
                        </Tooltip>
                    ) : (
                        deleteButton
                    ))}
                <Tooltip
                    title={
                        store.stale ? _('Resolve the conflict first') : 'Ctrl+S'
                    }
                >
                    <span>
                        <Button
                            size="small"
                            variant="contained"
                            startIcon={
                                store.saving ? (
                                    <CircularProgress
                                        size={14}
                                        color="inherit"
                                    />
                                ) : (
                                    <Save />
                                )
                            }
                            disabled={!canSave}
                            onClick={() => void store.save()}
                            data-action="save"
                        >
                            {_('Save')}
                        </Button>
                    </span>
                </Tooltip>
            </>
        );

        return (
            <SHeader compact={compact}>
                <SRow>
                    <STitle compact={compact}>{title}</STitle>
                    {chip && <Chip size="small" label={chip} />}
                    {store.dirty && <UnsavedIndicator />}
                    <SSpacer />
                    {actions}
                    {!compact && buttons}
                </SRow>
                {subtitle && <SSubtitle>{subtitle}</SSubtitle>}
                {compact && (
                    <SRow>
                        <SSpacer />
                        {buttons}
                    </SRow>
                )}
            </SHeader>
        );
    }
);

const isCompactProp = (prop: PropertyKey) => prop !== 'compact';

const SHeader = styled('div', { shouldForwardProp: isCompactProp })<{
    compact: boolean;
}>`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.5)};
    ${({ theme, compact }) =>
        !compact &&
        `
        position: sticky;
        top: 0;
        z-index: 2;
        padding: ${theme.spacing(1)} 0;
        background: ${theme.palette.background.default};
    `}
`;

const SRow = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
`;

const STitle = styled('h2', { shouldForwardProp: isCompactProp })<{
    compact: boolean;
}>`
    margin: 0;
    font-size: ${({ theme, compact }) =>
        compact ? theme.typography.subtitle1.fontSize : '20px'};
    font-weight: 600;
    word-break: break-word;
`;

const SSubtitle = styled('div')`
    font-size: ${({ theme }) => theme.typography.meta.fontSize};
    color: ${({ theme }) => theme.palette.text.secondary};
    word-break: break-all;
`;

const SSpacer = styled('div')`
    flex: 1;
`;
