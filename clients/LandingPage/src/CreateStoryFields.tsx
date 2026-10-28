import { FormControlLabel, Stack, styled, Switch } from '@mui/material';
import { STORY_LIMITS } from '@story/protocol';
import {
    LabeledField,
    LabeledTextField,
    spacingCss,
    type TStoryFormErrors,
    type TStoryFormValue,
} from '@story/ui';

type TProps = {
    value: TStoryFormValue;
    onChange: (value: TStoryFormValue) => void;
    errors: TStoryFormErrors;
    disabled?: boolean;
};

export const CreateStoryFields = ({
    value,
    onChange,
    errors,
    disabled,
}: TProps) => (
    <Stack spacing={2} sx={{ pt: 1 }}>
        <LabeledTextField
            label={_('Name')}
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            error={errors.name}
            disabled={disabled}
            required
            autoFocus
            dataField="name"
        />
        <LabeledTextField
            label={_('Author')}
            value={value.author}
            onChange={(e) => onChange({ ...value, author: e.target.value })}
            error={errors.author}
            disabled={disabled}
            dataField="author"
        />
        <LabeledTextField
            label={_('Email')}
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            error={errors.email}
            disabled={disabled}
            type="email"
            autoComplete="email"
            helperText={_(
                'Optional. Used as the author email of git commits and to reset a forgotten password.'
            )}
            dataField="email"
        />
        <LabeledTextField
            label={_('Password')}
            value={value.password}
            onChange={(e) => onChange({ ...value, password: e.target.value })}
            error={errors.password}
            disabled={disabled}
            type="password"
            required
            autoComplete="new-password"
            helperText={_(
                'At least %d characters',
                STORY_LIMITS.passwordMinLength
            )}
            dataField="password"
        />
        <LabeledTextField
            label={_('Confirm password')}
            value={value.passwordConfirm}
            onChange={(e) =>
                onChange({ ...value, passwordConfirm: e.target.value })
            }
            error={errors.passwordConfirm}
            disabled={disabled}
            type="password"
            required
            autoComplete="new-password"
            dataField="passwordConfirm"
        />
        <LabeledTextField
            label={_('Description')}
            value={value.description}
            onChange={(e) =>
                onChange({ ...value, description: e.target.value })
            }
            error={errors.description}
            disabled={disabled}
            multiline
            minRows={3}
            maxRows={10}
            dataField="description"
        />
        <SMapSize>
            <LabeledTextField
                label={_('Map width')}
                value={value.mapWidth}
                onChange={(e) =>
                    onChange({ ...value, mapWidth: e.target.value })
                }
                error={errors.mapWidth}
                disabled={disabled}
                type="number"
                helperText={_(
                    'Tiles, %d–%d',
                    STORY_LIMITS.mapSizeMin,
                    STORY_LIMITS.mapSizeMax
                )}
                dataField="mapWidth"
            />
            <LabeledTextField
                label={_('Map height')}
                value={value.mapHeight}
                onChange={(e) =>
                    onChange({ ...value, mapHeight: e.target.value })
                }
                error={errors.mapHeight}
                disabled={disabled}
                type="number"
                dataField="mapHeight"
            />
        </SMapSize>
        <LabeledField label={_('Public')}>
            <FormControlLabel
                control={
                    <Switch
                        checked={value.public}
                        onChange={(e) =>
                            onChange({ ...value, public: e.target.checked })
                        }
                        disabled={disabled}
                    />
                }
                label={_('Anyone may play it without the password')}
            />
        </LabeledField>
    </Stack>
);

const SMapSize = styled('div')`
    display: flex;
    gap: ${spacingCss(2)};
`;
