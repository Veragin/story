import { useState } from 'react';
import { Badge, styled, TextField, ToggleButton, Tooltip } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import NotesIcon from '@mui/icons-material/Notes';
import type { TFunctionDto } from '@story/visualizer-protocol';
import { spacingCss } from '@story/ui';
import { CodeTextArea } from './CodeTextArea';
import type { TInputProps } from './inputTypes';
import { SViewToggle } from './viewToggle';

type TProps = TInputProps<TFunctionDto> & {
    placeholder?: string;
};

type TView = 'code' | 'description';

const withDescription = (
    value: TFunctionDto,
    description: string
): TFunctionDto =>
    description === '' ? { code: value.code } : { ...value, description };

export const FunctionInput = ({
    value,
    onChange,
    placeholder,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TProps) => {
    const [view, setView] = useState<TView>(() =>
        value.description ? 'description' : 'code'
    );
    const noCode = value.code.trim() === '';
    const noDescription = !value.description;

    return (
        <SRow data-view={view} data-field={dataField}>
            <SEditor>
                {view === 'code' ? (
                    <CodeTextArea
                        value={value.code}
                        onChange={(code) => onChange({ ...value, code })}
                        hasError={hasError}
                        disabled={disabled}
                        ariaLabel={_('%s code', ariaLabel)}
                    />
                ) : (
                    <TextField
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={value.description ?? ''}
                        error={hasError}
                        disabled={disabled}
                        placeholder={placeholder}
                        slotProps={{
                            htmlInput: {
                                'aria-label': _('%s description', ariaLabel),
                                'data-field': 'function-description',
                            },
                        }}
                        onChange={(e) =>
                            onChange(withDescription(value, e.target.value))
                        }
                    />
                )}
            </SEditor>
            <SViewToggle
                size="small"
                exclusive
                orientation="vertical"
                value={view}
                onChange={(_e, next: TView | null) => next && setView(next)}
                aria-label={_('%s view', ariaLabel)}
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
                            invisible={!noDescription || view === 'description'}
                        >
                            <NotesIcon fontSize="small" />
                        </SBadge>
                    </Tooltip>
                </ToggleButton>
            </SViewToggle>
        </SRow>
    );
};

const SRow = styled('div')`
    display: flex;
    align-items: flex-start;
    gap: ${spacingCss(0.5)};
    width: 100%;
`;

const SEditor = styled('div')`
    flex: 1;
    min-width: 0;
`;

const SBadge = styled(Badge)`
    display: inline-flex;
    & .MuiBadge-dot {
        top: 2px;
        right: 2px;
    }
`;
