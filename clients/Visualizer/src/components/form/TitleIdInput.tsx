import EditIcon from '@mui/icons-material/Edit';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { TooltipIconButton } from '../buttons/TooltipIconButton';
import { FormTextInput } from './FormTextInput';
import type { TTitleId } from './useTitleId';

type TProps = {
    state: TTitleId;
    label: string;
    idError: string | null;
    idPrefix?: string;
    idHelperText?: string;
    autoFocus?: boolean;
    titleDataField?: string;
};

export const TitleIdInput = ({
    state,
    label,
    idError,
    idPrefix = '',
    idHelperText,
    autoFocus,
    titleDataField = 'title',
}: TProps) => {
    const { title, setTitle, id, customId, setCustomId } = state;
    const editingId = customId !== null;
    return (
        <>
            <FormTextInput
                label={label}
                value={title}
                autoFocus={autoFocus}
                onChange={(next = '') => setTitle(next)}
                error={editingId ? null : idError}
                helperText={
                    editingId
                        ? undefined
                        : _('Id: %s', `${idPrefix}${id || '…'}`)
                }
                helperActions={
                    !editingId && (
                        <TooltipIconButton
                            title={_('Edit id')}
                            icon={EditIcon}
                            data-action="edit-id"
                            onClick={() => setCustomId(id)}
                        />
                    )
                }
                dataField={titleDataField}
            />
            {editingId && (
                <FormTextInput
                    label={_('Id')}
                    value={customId}
                    spellCheck={false}
                    onChange={(next = '') => setCustomId(next)}
                    error={idError}
                    helperText={idHelperText}
                    startAdornment={idPrefix || undefined}
                    actions={
                        <TooltipIconButton
                            title={_('Generate from the title')}
                            icon={RestartAltIcon}
                            data-action="generate-id"
                            onClick={() => setCustomId(null)}
                        />
                    }
                    dataField="id"
                />
            )}
        </>
    );
};
