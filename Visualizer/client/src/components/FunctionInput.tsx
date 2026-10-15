import { useState } from 'react';
import {
    Badge,
    Button,
    IconButton,
    styled,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import NotesIcon from '@mui/icons-material/Notes';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import type { TDiagnosticDto, TFunctionDto } from '@story/visualizer-protocol';
import { CodeTextArea, FieldDiagnostics } from './CodeField';
import { FieldLabel } from './FieldLabel';
import { SAddRow, SField, SSpacer } from './fieldLayout';

type TProps = {
    label: string;
    value: TFunctionDto | undefined;
    onChange: (value: TFunctionDto | undefined) => void;
    optional?: boolean;
    emptyCode?: string;
    placeholder?: string;
    diagnostics?: TDiagnosticDto[];
    disabled?: boolean;
};

type TView = 'code' | 'description';

const withDescription = (
    value: TFunctionDto,
    description: string
): TFunctionDto =>
    description === '' ? { code: value.code } : { ...value, description };

export const FunctionInput = ({
    label,
    value,
    onChange,
    optional,
    emptyCode = '',
    placeholder,
    diagnostics = [],
    disabled,
}: TProps) => {
    const [view, setView] = useState<TView>(() =>
        value?.description ? 'description' : 'code'
    );
    const hasError = diagnostics.length > 0;

    if (value === undefined && optional) {
        return (
            <SAddRow>
                <Button
                    size="small"
                    color="inherit"
                    startIcon={<AddIcon fontSize="small" />}
                    disabled={disabled}
                    data-action="add-function"
                    onClick={() => onChange({ code: emptyCode })}
                >
                    {label}
                </Button>
                <FieldDiagnostics diagnostics={diagnostics} />
            </SAddRow>
        );
    }

    const current = value ?? { code: '' };
    const noCode = current.code.trim() === '';
    const noDescription = !current.description;

    return (
        <SField data-view={view}>
            <SHeader>
                <FieldLabel hasError={hasError}>{label}</FieldLabel>
                <SSpacer />
                <SToggle
                    size="small"
                    exclusive
                    value={view}
                    onChange={(_e, next: TView | null) => next && setView(next)}
                    aria-label={_('%s view', label)}
                >
                    <ToggleButton
                        value="code"
                        aria-label={_('Code')}
                        data-action="show-code"
                        data-empty={noCode ? 'true' : undefined}
                    >
                        <Tooltip title={noCode ? _('Code (empty)') : _('Code')}>
                            <SBadge
                                variant="dot"
                                color="warning"
                                invisible={!noCode || view === 'code'}
                            >
                                <CodeIcon fontSize="small" />
                            </SBadge>
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton
                        value="description"
                        aria-label={_('Description')}
                        data-action="show-description"
                        data-empty={noDescription ? 'true' : undefined}
                    >
                        <Tooltip
                            title={
                                noDescription
                                    ? _('Description (none yet)')
                                    : _('Description')
                            }
                        >
                            <SBadge
                                variant="dot"
                                color="warning"
                                invisible={
                                    !noDescription || view === 'description'
                                }
                            >
                                <NotesIcon fontSize="small" />
                            </SBadge>
                        </Tooltip>
                    </ToggleButton>
                </SToggle>
                {optional && (
                    <Tooltip title={_('Remove %s', label)}>
                        <IconButton
                            size="small"
                            onClick={() => onChange(undefined)}
                            disabled={disabled}
                            aria-label={_('Remove')}
                            data-action="remove-function"
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
            </SHeader>
            {view === 'code' ? (
                <CodeTextArea
                    value={current.code}
                    onChange={(code) => onChange({ ...current, code })}
                    hasError={hasError}
                    disabled={disabled}
                    ariaLabel={_('%s code', label)}
                />
            ) : (
                <TextField
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    value={current.description ?? ''}
                    error={hasError}
                    disabled={disabled}
                    placeholder={placeholder}
                    slotProps={{
                        htmlInput: {
                            'aria-label': _('%s description', label),
                            'data-field': 'function-description',
                        },
                    }}
                    onChange={(e) =>
                        onChange(withDescription(current, e.target.value))
                    }
                />
            )}
            <FieldDiagnostics diagnostics={diagnostics} />
        </SField>
    );
};

const SHeader = styled('div')`
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 28px;
`;

const SToggle = styled(ToggleButtonGroup)`
    & .MuiToggleButton-root {
        padding: 2px 6px;
    }
`;

const SBadge = styled(Badge)`
    display: inline-flex;
    & .MuiBadge-dot {
        top: 2px;
        right: 2px;
    }
`;
