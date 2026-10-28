import { useState } from 'react';
import { Stack } from '@mui/material';
import type { TCreateStoryBody, TSetupGitBody } from '@story/protocol';
import {
    CollapsibleSection,
    EMPTY_STORY_FORM,
    hasErrors,
    toCreateBody,
    validateStoryForm,
} from '@story/ui';
import { errorMessage } from './api';
import { CreateStoryFields } from './CreateStoryFields';
import { GitConnectFields } from './GitConnectFields';
import {
    EMPTY_GIT_CONNECT,
    hasGitConnectErrors,
    toGitSetup,
    validateGitConnect,
} from './gitConnectForm';
import { StoryFormPage } from './StoryFormPage';

type TProps = {
    gitAvailable: boolean;
    onSubmit: (
        body: TCreateStoryBody,
        git: TSetupGitBody | null
    ) => Promise<void>;
    onClose: () => void;
};

export const CreateStoryPage = ({
    gitAvailable,
    onSubmit,
    onClose,
}: TProps) => {
    const [value, setValue] = useState(EMPTY_STORY_FORM);
    const [git, setGit] = useState(EMPTY_GIT_CONNECT);
    const [gitExpanded, setGitExpanded] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const errors = validateStoryForm(value, { passwordRequired: true });
    const gitErrors = gitAvailable ? validateGitConnect(git) : {};
    const invalid = hasErrors(errors) || hasGitConnectErrors(gitErrors);

    const create = async () => {
        setSubmitted(true);
        if (hasGitConnectErrors(gitErrors)) setGitExpanded(true);
        if (invalid) return;
        setSaving(true);
        setError(null);
        try {
            await onSubmit(
                toCreateBody(value),
                gitAvailable ? toGitSetup(git) : null
            );
        } catch (e) {
            setError(errorMessage(e));
            setSaving(false);
        }
    };

    return (
        <StoryFormPage
            title={_('New story')}
            error={error}
            saving={saving}
            submitLabel={_('Create')}
            savingLabel={_('Creating…')}
            submitBlocked={submitted && invalid}
            submitAction="create"
            onSubmit={() => void create()}
            onClose={onClose}
        >
            <Stack spacing={3}>
                <CreateStoryFields
                    value={value}
                    onChange={setValue}
                    errors={submitted ? errors : {}}
                    disabled={saving}
                />
                {gitAvailable && (
                    <CollapsibleSection
                        title={_('Git repository')}
                        summary={git.remoteUrl.trim() || _('Not connected')}
                        expanded={gitExpanded}
                        onExpandedChange={setGitExpanded}
                    >
                        <GitConnectFields
                            value={git}
                            onChange={setGit}
                            errors={submitted ? gitErrors : {}}
                            disabled={saving}
                        />
                    </CollapsibleSection>
                )}
            </Stack>
        </StoryFormPage>
    );
};
