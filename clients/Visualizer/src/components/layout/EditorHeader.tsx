import type { ReactNode } from 'react';
import { Button, Chip, CircularProgress, Tooltip, styled } from '@mui/material';
import Restore from '@mui/icons-material/Restore';
import Save from '@mui/icons-material/Save';
import { observer } from 'mobx-react-lite';
import { spacingCss } from '@story/ui';
import { useKey } from '../../shell/keyboard';
import { DeleteButton } from '../buttons/DeleteButton';
import type { IEditorSource } from './editorSource';
import { UnsavedIndicator } from './UnsavedIndicator';

type TProps = {
    title: ReactNode;
    store: IEditorSource;
    chip?: string;
    subtitle?: ReactNode;
    actions?: ReactNode;
    onDelete?: () => void;
    deleteLabel?: string;
    deleteBlocker?: string;
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
                tone="error"
                onClick={onDelete}
                disabled={store.saving || !!deleteBlocker}
                data-action="delete"
            />
        );

        return (
            <SHeader>
                <SRow>
                    <STitle>{title}</STitle>
                    {chip && <Chip size="small" label={chip} />}
                    {store.dirty && <UnsavedIndicator />}
                    <SSpacer />
                    {actions}
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
                            store.stale
                                ? _('Resolve the conflict first')
                                : 'Ctrl+S'
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
                </SRow>
                {subtitle && <SSubtitle>{subtitle}</SSubtitle>}
            </SHeader>
        );
    }
);

const SHeader = styled('div')`
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.5)};
    padding: ${spacingCss(1)} 0;
    background: ${({ theme }) => theme.palette.background.default};
`;

const SRow = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
`;

const STitle = styled('h2')`
    margin: 0;
    font-size: 20px;
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
