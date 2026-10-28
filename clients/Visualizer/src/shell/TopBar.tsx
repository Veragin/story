import { useEffect } from 'react';
import { Button, styled, Tab, Tabs } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { appTheme, Row, spacingCss } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { landingUrl, playerUrl, STORY_ID } from '../api';
import { GitButton } from './GitButton';
import { router, TPage, TRoute } from './router';
import { shell } from './shellStore';
import { storyInfo } from './storyInfoStore';

type TTab = {
    value: string;
    label: () => string;
    route?: TRoute;
    pages: TPage[];
};

const TABS: TTab[] = [
    {
        value: 'settings',
        label: () => storyInfo.info?.name ?? STORY_ID,
        route: { page: 'settings' },
        pages: ['settings'],
    },
    {
        value: 'map',
        label: () => _('Map'),
        route: { page: 'map' },
        pages: ['map'],
    },
    {
        value: 'timeline',
        label: () => _('Timeline'),
        route: { page: 'timeline' },
        pages: ['timeline', 'chapter'],
    },
    {
        value: 'entities',
        label: () => _('Entities'),
        route: { page: 'entities' },
        pages: ['entities', 'catalog'],
    },
    {
        value: 'structure',
        label: () => _('Structure'),
        route: { page: 'structure' },
        pages: ['structure'],
    },
    {
        value: 'engine',
        label: () => _('Engine'),
        route: { page: 'engine' },
        pages: ['engine'],
    },
];

const TOP_BAR_HEIGHT = 48;

export const TopBar = observer(() => {
    const active =
        TABS.find((t) => t.pages.includes(router.route.page))?.value ?? false;

    useEffect(() => void storyInfo.load(), []);

    return (
        <SBar>
            <SBack
                color="inherit"
                size="small"
                startIcon={<ArrowBackIcon />}
                href={landingUrl()}
            >
                {_('Stories')}
            </SBack>
            <STabs
                value={active}
                textColor="inherit"
                indicatorColor="secondary"
            >
                {TABS.map((tab) => (
                    <STab
                        key={tab.value}
                        value={tab.value}
                        label={tab.label()}
                        disabled={!tab.route}
                        {...(tab.route ? { href: router.href(tab.route) } : {})}
                    />
                ))}
            </STabs>
            <Button
                color="inherit"
                size="small"
                startIcon={<PlayArrowIcon />}
                href={playerUrl(STORY_ID)}
                target="_blank"
                rel="noopener"
                sx={{ flexShrink: 0, textTransform: 'none' }}
            >
                {_('Play')}
            </Button>
            <GitButton />
            <SControlBar ref={shell.setControlBarEl} />
        </SBar>
    );
});

// appTheme's navy on purpose; the rest of the app uses darkTheme
const SBar = styled(Row)`
    flex: 0 0 ${TOP_BAR_HEIGHT}px;
    height: ${TOP_BAR_HEIGHT}px;
    align-items: center;
    gap: ${spacingCss(2)};
    padding: 0 ${spacingCss(2)};
    background-color: ${appTheme.palette.primary.dark};
    border-bottom: 1px solid ${appTheme.palette.primary.main};
    color: white;
`;

const SBack = styled(Button)`
    flex-shrink: 0;
    text-transform: none;
    opacity: 0.8;
`;

const STabs = styled(Tabs)`
    min-height: ${TOP_BAR_HEIGHT}px;
`;

const STab = styled(Tab)`
    min-height: ${TOP_BAR_HEIGHT}px;
    text-transform: none;
`;

const SControlBar = styled(Row)`
    flex: 1;
    min-width: 0;
    height: 100%;
    justify-content: flex-end;
    align-items: center;
    gap: ${spacingCss(1)};
    overflow: hidden;

    & > * {
        flex-shrink: 0;
    }
`;
