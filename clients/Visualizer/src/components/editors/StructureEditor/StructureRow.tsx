import { useState } from 'react';
import { Checkbox, styled, TextField, Tooltip } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { spacingCss } from '@story/ui';
import type { TFieldDesc } from '@story/protocol';
import { fieldKeyError } from '../../../structure/fieldKey';
import { RowActions } from '../../buttons/RowActions';
import { DescriptionToggleButton } from '../../buttons/DescriptionToggleButton';
import { FieldTypePicker } from './FieldTypePicker';
import { withDescription } from '../../../values/withDescription';
import type {
    TLiteralDraft,
    TStructureRow,
} from '../../../structure/structureRows';

type TProps = {
    row: TStructureRow;
    onChange: (row: TStructureRow) => void;
    otherKeys: readonly string[];
    index: number;
    count: number;
    onMove: (from: number, to: number) => void;
    onRemove: (index: number) => void;
    literals?: TLiteralDraft;
    disabled?: boolean;
};

export const StructureRow = ({
    row,
    onChange,
    otherKeys,
    index,
    count,
    onMove,
    onRemove,
    literals,
    disabled,
}: TProps) => {
    const { field } = row;
    const [showDescription, setShowDescription] = useState(
        () => !!field.description
    );
    const locked = !!field.locked;
    const off = disabled || locked;
    const set = (next: TFieldDesc) => onChange({ ...row, field: next });
    const keyError =
        field.key === ''
            ? _('Enter a name')
            : fieldKeyError(field.key, otherKeys);
    const name = field.key || _('Field');

    return (
        <SRow
            role="listitem"
            data-key={field.key}
            data-locked={locked ? 'true' : undefined}
        >
            <SMain>
                {locked && (
                    <Tooltip title={_('Used by the engine')}>
                        <SLock
                            tabIndex={0}
                            aria-hidden={false}
                            aria-label={_('Used by the engine')}
                        />
                    </Tooltip>
                )}
                <SKeyField
                    size="small"
                    value={field.key}
                    disabled={off}
                    error={!!keyError}
                    helperText={keyError ?? undefined}
                    slotProps={{
                        htmlInput: {
                            'aria-label': _('Field name'),
                            'data-field': 'field-key',
                        },
                    }}
                    onChange={(e) =>
                        set({ ...field, key: e.target.value.trim() })
                    }
                />
                <FieldTypePicker
                    value={field.type}
                    onChange={(type) => set({ ...field, type })}
                    literals={literals}
                    disabled={off}
                    ariaLabel={name}
                />
                <Tooltip title={_('Optional')}>
                    <Checkbox
                        size="small"
                        checked={field.optional}
                        disabled={off}
                        inputProps={{
                            'aria-label': _('%s is optional', name),
                        }}
                        onChange={(e) =>
                            set({ ...field, optional: e.target.checked })
                        }
                    />
                </Tooltip>
                <DescriptionToggleButton
                    shown={showDescription}
                    onToggle={() => setShowDescription((shown) => !shown)}
                />
                <RowActions
                    index={index}
                    count={count}
                    onMove={onMove}
                    onRemove={onRemove}
                    disabled={off}
                    rowLabel={name}
                />
            </SMain>
            {showDescription && (
                <TextField
                    size="small"
                    fullWidth
                    multiline
                    value={field.description ?? ''}
                    disabled={off}
                    placeholder={_('What the field means')}
                    slotProps={{
                        htmlInput: {
                            'aria-label': _('Description of %s', name),
                            'data-field': 'field-description',
                        },
                    }}
                    onChange={(e) =>
                        set(withDescription(field, e.target.value))
                    }
                />
            )}
        </SRow>
    );
};

const SRow = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.5)};
    &[data-locked='true'] {
        opacity: 0.6;
    }
`;

const SMain = styled('div')`
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: ${spacingCss(0.5)};
`;

const SLock = styled(LockIcon)`
    margin-top: 10px;
    font-size: 16px;
    color: ${({ theme }) => theme.palette.text.secondary};
`;

const SKeyField = styled(TextField)`
    flex: 0 1 160px;
    min-width: 96px;
`;
