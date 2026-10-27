import type { ComponentProps } from 'react';
import { FormControlLabel, Stack, Switch } from '@mui/material';
import { STORY_LIMITS } from '@story/protocol';
import { LabeledField } from '../LabeledField';
import { LabeledTextField } from '../LabeledTextField';
import type {
    TStoryFormErrors,
    TStoryFormMode,
    TStoryFormValue,
} from './storyForm';

type TProps = {
    value: TStoryFormValue;
    onChange: (value: TStoryFormValue) => void;
    errors: TStoryFormErrors;
    mode: TStoryFormMode;
    disabled?: boolean;
};

export const StoryFormFields = ({
    value,
    onChange,
    errors,
    mode,
    disabled,
}: TProps) => {
    const field = (
        key: Exclude<keyof TStoryFormValue, 'public'>,
        label: string,
        props: Partial<ComponentProps<typeof LabeledTextField>> = {}
    ) => (
        <LabeledTextField
            {...props}
            label={label}
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            error={errors[key]}
            disabled={disabled || props.disabled}
            dataField={key}
        />
    );
    const passwordHint =
        mode === 'edit'
            ? _('Leave empty to keep the current password')
            : _('At least %d characters', STORY_LIMITS.passwordMinLength);

    return (
        <Stack spacing={2} sx={{ pt: 1 }}>
            {field('name', _('Name'), {
                required: true,
                autoFocus: true,
            })}
            {field('author', _('Author'))}
            {field('email', _('Email'), {
                type: 'email',
                autoComplete: 'email',
                helperText: _(
                    'Optional. Used as the author email of git commits and to reset a forgotten password.'
                ),
            })}
            {field(
                'password',
                mode === 'edit' ? _('New password') : _('Password'),
                {
                    type: 'password',
                    required: mode !== 'edit',
                    autoComplete: 'new-password',
                    helperText: passwordHint,
                }
            )}
            {field('passwordConfirm', _('Confirm password'), {
                type: 'password',
                required: mode !== 'edit',
                autoComplete: 'new-password',
            })}
            {field('description', _('Description'), {
                multiline: true,
                minRows: 3,
                maxRows: 10,
            })}
            {field('mapWidth', _('Map width'), {
                type: 'number',
                disabled: mode === 'edit',
                helperText:
                    mode === 'edit'
                        ? _('Set at creation')
                        : _(
                              'Tiles, %d–%d',
                              STORY_LIMITS.mapSizeMin,
                              STORY_LIMITS.mapSizeMax
                          ),
            })}
            {field('mapHeight', _('Map height'), {
                type: 'number',
                disabled: mode === 'edit',
            })}
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
};
