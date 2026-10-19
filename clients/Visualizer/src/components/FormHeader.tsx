import type { ReactNode } from 'react';
import { Button, Chip, CircularProgress, Tooltip, styled } from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import Restore from '@mui/icons-material/Restore';
import Save from '@mui/icons-material/Save';
import { observer } from 'mobx-react-lite';
import { spacingCss } from '@story/ui';
import { useKey } from '../shell';

export interface IFormHeaderSource {
    readonly dirty: boolean;
    readonly saving: boolean;
    readonly stale: unknown;
    discard(): void;
    save(): Promise<boolean>;
}

type TProps = {
    title: ReactNode;
    store: IFormHeaderSource;
    onDelete?: () => void;
    deleteTooltip?: string;
    children?: ReactNode;
};

export const FormHeader = observer(
    ({ title, store, onDelete, deleteTooltip, children }: TProps) => {
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

        return (
            <SHeader>
                <STitle>{title}</STitle>
                {store.dirty && (
                    <Chip size="small" color="warning" label={_('unsaved')} />
                )}
                <SSpacer />
                {children}
                <Tooltip title={_('Discard unsaved input')}>
                    <span>
                        <Button
                            size="small"
                            color="inherit"
                            startIcon={<Restore />}
                            disabled={!store.dirty || store.saving}
                            onClick={store.discard}
                            data-action="discard"
                        >
                            {_('Discard')}
                        </Button>
                    </span>
                </Tooltip>
                {onDelete && (
                    <Tooltip title={deleteTooltip ?? ''}>
                        <span>
                            <Button
                                size="small"
                                color="error"
                                startIcon={<Delete />}
                                onClick={onDelete}
                                disabled={store.saving || !!deleteTooltip}
                                data-action="delete"
                            >
                                {_('Delete')}
                            </Button>
                        </span>
                    </Tooltip>
                )}
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
            </SHeader>
        );
    }
);

const SHeader = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
    position: sticky;
    top: 0;
    z-index: 2;
    padding: ${spacingCss(1)} 0;
    background: ${({ theme }) => theme.palette.background.default};
`;

const STitle = styled('h2')`
    margin: 0;
    font-size: 20px;
    font-weight: 600;
`;

const SSpacer = styled('div')`
    flex: 1;
`;
