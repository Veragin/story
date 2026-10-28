import { useState } from 'react';
import { Autocomplete, Button, styled, TextField } from '@mui/material';
import { spacingCss } from '@story/ui';
import { HintText } from '../../feedback/HintText';
import { ActionRow } from '../../layout/ActionRow';

type TProps = {
    name: string;
    onCreate: (values: string[]) => void;
    onCancel: () => void;
};

const cleanValues = (values: string[]) => [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

export const NewLiteralEditor = ({ name, onCreate, onCancel }: TProps) => {
    const [values, setValues] = useState<string[]>([]);
    return (
        <SEditor data-new-literal={name}>
            <HintText>
                {_('New local literal %s: its first values', name)}
            </HintText>
            <Autocomplete<string, true, false, true>
                multiple
                freeSolo
                size="small"
                options={[]}
                value={values}
                onChange={(_e, next) => setValues(cleanValues(next))}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder={_('Type a value, then Enter')}
                        slotProps={{
                            htmlInput: {
                                ...params.inputProps,
                                'aria-label': _('Values of %s', name),
                            },
                        }}
                    />
                )}
            />
            <ActionRow>
                <Button size="small" color="inherit" onClick={onCancel}>
                    {_('Cancel')}
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    disabled={values.length === 0}
                    data-action="create-literal"
                    onClick={() => onCreate(values)}
                >
                    {_('Create')}
                </Button>
            </ActionRow>
        </SEditor>
    );
};

const SEditor = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.5)};
    padding: ${spacingCss(1)};
    border: 1px dashed ${({ theme }) => theme.palette.border.strong};
    border-radius: 4px;
`;

