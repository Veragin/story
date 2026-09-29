import {
    FormControlLabel,
    Stack,
    Switch,
    TextField,
    type TextFieldProps,
} from '@mui/material';
import { STORY_LIMITS } from '@story/visualizer-protocol';
import type { TStoryFormErrors, TStoryFormValue } from './storyForm';

type TProps = {
    value: TStoryFormValue;
    onChange: (value: TStoryFormValue) => void;
    /** Shown under their fields; the dialogs pass them once the user has tried to submit. */
    errors: TStoryFormErrors;
    /** Edit: the password may stay empty, and the map size is read-only (plan D6). */
    mode: 'create' | 'edit';
    disabled?: boolean;
};

/** The fields of `CreateStoryDialog` and `EditStoryDialog`. */
export const StoryFormFields = ({
    value,
    onChange,
    errors,
    mode,
    disabled,
}: TProps) => {
    const field = (
        key: Exclude<keyof TStoryFormValue, 'public'>,
        props: TextFieldProps
    ) => (
        <TextField
            fullWidth
            size="small"
            {...props}
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            error={errors[key] !== undefined}
            helperText={errors[key] ?? props.helperText}
            disabled={disabled || props.disabled}
            // `data-field` lets a test find a field without a DOM testing library
            inputProps={{ 'data-field': key }}
        />
    );
    const passwordHint =
        mode === 'edit'
            ? _('Leave empty to keep the current password')
            : _('At least %d characters', STORY_LIMITS.passwordMinLength);

    return (
        <Stack spacing={2} sx={{ pt: 1 }}>
            {field('name', {
                label: _('Name'),
                required: true,
                autoFocus: true,
            })}
            {field('author', { label: _('Author') })}
            <Stack direction="row" spacing={2}>
                {field('password', {
                    label: mode === 'edit' ? _('New password') : _('Password'),
                    type: 'password',
                    required: mode === 'create',
                    autoComplete: 'new-password',
                    helperText: passwordHint,
                })}
                {field('passwordConfirm', {
                    label: _('Confirm password'),
                    type: 'password',
                    required: mode === 'create',
                    autoComplete: 'new-password',
                })}
            </Stack>
            {field('description', {
                label: _('Description'),
                multiline: true,
                minRows: 3,
                maxRows: 10,
            })}
            <Stack direction="row" spacing={2}>
                {field('mapWidth', {
                    label: _('Map width'),
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
                {field('mapHeight', {
                    label: _('Map height'),
                    type: 'number',
                    disabled: mode === 'edit',
                })}
            </Stack>
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
                label={_('Public: anyone may play it without the password')}
            />
        </Stack>
    );
};
