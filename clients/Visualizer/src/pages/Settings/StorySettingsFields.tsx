import { styled } from '@mui/material';
import {
    spacingCss,
    type TStoryFormErrors,
    type TStoryFormValue,
} from '@story/ui';
import { FormCheckbox } from '../../components/form/FormCheckbox';
import { FormField } from '../../components/form/FormField';
import { FormTextInput } from '../../components/form/FormTextInput';
import { TextInput } from '../../components/inputs/TextInput';

type TProps = {
    value: TStoryFormValue;
    onChange: (value: TStoryFormValue) => void;
    errors: TStoryFormErrors;
    disabled?: boolean;
};

export const StorySettingsFields = ({
    value,
    onChange,
    errors,
    disabled,
}: TProps) => (
    <>
        <FormTextInput
            label={_('Name')}
            value={value.name}
            onChange={(name = '') => onChange({ ...value, name })}
            error={errors.name}
            disabled={disabled}
            autoFocus
            dataField="name"
        />
        <FormTextInput
            label={_('Author')}
            value={value.author}
            onChange={(author = '') => onChange({ ...value, author })}
            error={errors.author}
            disabled={disabled}
            dataField="author"
        />
        <FormTextInput
            label={_('Email')}
            value={value.email}
            onChange={(email = '') => onChange({ ...value, email })}
            error={errors.email}
            disabled={disabled}
            autoComplete="email"
            helperText={_(
                'Optional. Used as the author email of git commits and to reset a forgotten password.'
            )}
            dataField="email"
        />
        <FormTextInput
            label={_('New password')}
            value={value.password}
            onChange={(password = '') => onChange({ ...value, password })}
            error={errors.password}
            disabled={disabled}
            type="password"
            autoComplete="new-password"
            helperText={_('Leave empty to keep the current password')}
            dataField="password"
        />
        <FormTextInput
            label={_('Confirm password')}
            value={value.passwordConfirm}
            onChange={(passwordConfirm = '') =>
                onChange({ ...value, passwordConfirm })
            }
            error={errors.passwordConfirm}
            disabled={disabled}
            type="password"
            autoComplete="new-password"
            dataField="passwordConfirm"
        />
        <FormTextInput
            label={_('Description')}
            value={value.description}
            onChange={(description = '') => onChange({ ...value, description })}
            error={errors.description}
            disabled={disabled}
            multiline
            minRows={3}
            dataField="description"
        />
        <FormField label={_('Map size')} helperText={_('Set at creation')}>
            <SMapSize>
                <TextInput
                    value={value.mapWidth}
                    onChange={() => {}}
                    ariaLabel={_('Map width')}
                    disabled
                    dataField="mapWidth"
                />
                <TextInput
                    value={value.mapHeight}
                    onChange={() => {}}
                    ariaLabel={_('Map height')}
                    disabled
                    dataField="mapHeight"
                />
            </SMapSize>
        </FormField>
        <FormCheckbox
            label={_('Public')}
            value={value.public}
            onChange={(next = false) => onChange({ ...value, public: next })}
            disabled={disabled}
            helperText={_('Anyone may play it without the password')}
            dataField="public"
        />
    </>
);

const SMapSize = styled('div')`
    display: flex;
    gap: ${spacingCss(1)};

    & > * {
        flex: 1;
        min-width: 0;
    }
`;
