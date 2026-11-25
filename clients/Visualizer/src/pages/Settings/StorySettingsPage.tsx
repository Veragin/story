import { useEffect, useState } from 'react';
import { Alert, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { api as defaultApi, auth, type TVisualizerApi } from '../../api';
import type { AiStore } from '../../ai/AiStore';
import { FormPage } from '../../components/layout/formLayout';
import { MasterDetailPage } from '../../components/layout/MasterDetailPage';
import {
    SideMenu,
    type TSideMenuEntry,
} from '../../components/layout/SideMenu';
import { aiStore, gitStore } from '../../context';
import type { GitStore } from '../../git/GitStore';
import {
    PageContainer,
    router,
    SETTINGS_SECTIONS,
    type TSettingsSection,
} from '../../shell';
import {
    storyInfo as defaultStoryInfo,
    type StoryInfoStore,
} from '../../shell/storyInfoStore';
import { AiSettings } from './AiSettings';
import { GeneralSettings } from './GeneralSettings';
import { GitSettings } from './GitSettings';
import { StorySettingsStore } from './StorySettingsStore';

const DEFAULT_SECTION: TSettingsSection = 'general';

const SECTION_TITLES: Record<TSettingsSection, () => string> = {
    general: () => _('General'),
    ai: () => _('AI'),
    git: () => _('Git'),
};

type TProps = {
    section?: TSettingsSection;
    api?: TVisualizerApi;
    git?: GitStore;
    ai?: AiStore;
    storyInfo?: StoryInfoStore;
};

export const StorySettingsPage = observer(
    ({
        section = DEFAULT_SECTION,
        api = defaultApi,
        git = gitStore,
        ai = aiStore,
        storyInfo = defaultStoryInfo,
    }: TProps) => {
        const [store] = useState(
            () => new StorySettingsStore({ api, auth, storyInfo, git })
        );

        useEffect(() => void store.load(), [store]);
        useEffect(() => git.start(), [git]);
        useEffect(() => ai.start(), [ai]);

        const entries = SETTINGS_SECTIONS.map(
            (name): TSideMenuEntry => ({
                name,
                label: SECTION_TITLES[name](),
                href: router.href({ page: 'settings', section: name }),
                selected: section === name,
                unsaved:
                    name === 'general' && section !== 'general' && store.dirty,
            })
        );

        const renderSection = () => {
            switch (section) {
                case 'general':
                    return (
                        <GeneralSettings
                            store={store}
                            api={api}
                            storyInfo={storyInfo}
                        />
                    );
                case 'ai':
                    return (
                        <AiSettings aiFeature={store.info?.aiFeature} ai={ai} />
                    );
                case 'git':
                    return <GitSettings git={git} />;
            }
        };

        return (
            <PageContainer>
                <MasterDetailPage
                    list={
                        <SideMenu
                            groups={[{ title: _('Story settings'), entries }]}
                        />
                    }
                >
                    <FormPage>
                        <Typography variant="h6" component="h1">
                            {SECTION_TITLES[section]()}
                        </Typography>
                        {store.error && (
                            <Alert severity="error">{store.error}</Alert>
                        )}
                        {renderSection()}
                    </FormPage>
                </MasterDetailPage>
            </PageContainer>
        );
    }
);
