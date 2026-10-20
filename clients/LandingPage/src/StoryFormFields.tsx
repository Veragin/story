import {
    Divider,
    FormControlLabel,
    Stack,
    Switch,
    TextField,
    type TextFieldProps,
} from '@mui/material';
import { STORY_LIMITS } from '@story/protocol';
import type {
    TStoryFormErrors,
    TStoryFormMode,
    TStoryFormValue,
    TStoryGitState,
} from './storyForm';

type TProps = {
    value: TStoryFormValue;
    onChange: (value: TStoryFormValue) => void;
    errors: TStoryFormErrors;
    mode: TStoryFormMode;
    git: TStoryGitState;
    disabled?: boolean;
};

export const StoryFormFields = ({
    value,
    onChange,
    errors,
    mode,
    git,
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
            inputProps={{ 'data-field': key }}
        />
    );
    const passwordHint =
        mode === 'edit'
            ? _('Leave empty to keep the current password')
            : _('At least %d characters', STORY_LIMITS.passwordMinLength);
    const gitTokenHint = git?.config?.hasToken
        ? _('Leave empty to keep the current token')
        : _('Leave empty for a public repository');

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
                    required: mode !== 'edit',
                    autoComplete: 'new-password',
                    helperText: passwordHint,
                })}
                {field('passwordConfirm', {
                    label: _('Confirm password'),
                    type: 'password',
                    required: mode !== 'edit',
                    autoComplete: 'new-password',
                })}
            </Stack>
            {field('description', {
                label: _('Description'),
                multiline: true,
                minRows: 3,
                maxRows: 10,
            })}
            {mode !== 'import' && (
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
            )}
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
            {git && (
                <>
                    <Divider textAlign="left">{_('Git repository')}</Divider>
                    {field('gitRemoteUrl', {
                        label: _('Repository URL'),
                        placeholder: 'https://github.com/me/story.git',
                        helperText: git.config
                            ? _('Branch %s', git.config.branch)
                            : _('Optional: the story is pushed there'),
                    })}
                    {field('gitToken', {
                        label: _('Access token'),
                        type: 'password',
                        autoComplete: 'new-password',
                        helperText: _(
                            '%s. Stored encrypted; use a token limited to this repository.',
                            gitTokenHint
                        ),
                    })}
                </>
            )}
        </Stack>
    );
};
