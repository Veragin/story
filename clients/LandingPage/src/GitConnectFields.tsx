import { Stack, styled, TextField } from '@mui/material';
import { spacingCss } from '@story/ui';
import type { TGitConnectErrors, TGitConnectValue } from './gitConnectForm';

type TProps = {
    value: TGitConnectValue;
    onChange: (value: TGitConnectValue) => void;
    errors: TGitConnectErrors;
    disabled?: boolean;
};

export const GitConnectFields = ({
    value,
    onChange,
    errors,
    disabled,
}: TProps) => (
    <SFields spacing={2}>
        <TextField
            fullWidth
            size="small"
            label={_('Repository URL')}
            placeholder="https://github.com/me/story.git"
            value={value.remoteUrl}
            onChange={(e) => onChange({ ...value, remoteUrl: e.target.value })}
            error={errors.remoteUrl !== undefined}
            helperText={
                errors.remoteUrl ?? _('Optional: the story is pushed there')
            }
            disabled={disabled}
            inputProps={{ 'data-field': 'gitRemoteUrl' }}
        />
        <TextField
            fullWidth
            size="small"
            label={_('Access token')}
            type="password"
            autoComplete="new-password"
            value={value.token}
            onChange={(e) => onChange({ ...value, token: e.target.value })}
            error={errors.token !== undefined}
            helperText={
                errors.token ??
                _(
                    '%s. Stored encrypted; use a token limited to this repository.',
                    _('Leave empty for a public repository')
                )
            }
            disabled={disabled}
            inputProps={{ 'data-field': 'gitToken' }}
        />
    </SFields>
);

const SFields = styled(Stack)`
    padding-top: ${spacingCss(1)};
`;
