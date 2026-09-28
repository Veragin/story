import { styled, Tab, Tabs } from '@mui/material';
import { appTheme, Row, spacingCss } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { router, TPage, TRoute } from './router';
import { shell } from './shellStore';

type TTab = {
    value: string;
    label: () => string;
    route?: TRoute;
    /** pages that highlight this tab */
    pages: TPage[];
};

const TABS: TTab[] = [
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
        pages: ['entities'],
    },
    // future (docs/Visualizer.md "Structure"), out of scope for now
    { value: 'structure', label: () => _('Structure'), pages: [] },
];

export const TOP_BAR_HEIGHT = 48;

export const TopBar = observer(() => {
    const active =
        TABS.find((t) => t.pages.includes(router.route.page))?.value ?? false;

    return (
        <SBar>
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
            <SControlBar ref={shell.setControlBarEl} />
        </SBar>
    );
});

/** Keeps the navy bar of `appTheme`; the rest of the app runs on the Visualizer's `darkTheme`. */
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

const STabs = styled(Tabs)`
    min-height: ${TOP_BAR_HEIGHT}px;
`;

const STab = styled(Tab)`
    min-height: ${TOP_BAR_HEIGHT}px;
    text-transform: none;
` as typeof Tab;

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
