import { Button, MenuItem, Select, styled } from '@mui/material';
import { register } from '@story/data';
import { Row, spacingCss } from '@story/ui';
import type { TChapterId } from '@story/types';
import { useVisualizerStore } from '../context';

export const Nav = styled(Row)`
    gap: ${spacingCss(1)};
    align-items: center;
    padding: 0 ${spacingCss(2)};

    & > *:first-child {
        flex: 1;
    }
`;

export const NavPicker = () => {
    const store = useVisualizerStore();

    return (
        <Row>
            <Button
                onClick={() => store.setActiveTab(null)}
                variant={store.activeTab === null ? 'contained' : 'text'}
                color={store.activeTab === null ? 'primary' : 'inherit'}
            >
                {_('Chapter Timeline')}
            </Button>
            <Button
                onClick={() =>
                    store.setActiveTab({ tab: 'map', mapId: 'global' })
                }
                variant={store.activeTab?.tab === 'map' ? 'contained' : 'text'}
                color={store.activeTab?.tab === 'map' ? 'primary' : 'inherit'}
            >
                {_('Map Editor')}
            </Button>
            <Button
                onClick={() => store.setActiveTab({ tab: 'entities' })}
                variant={
                    store.activeTab?.tab === 'entities' ? 'contained' : 'text'
                }
                color={
                    store.activeTab?.tab === 'entities' ? 'primary' : 'inherit'
                }
            >
                {_('Entities')}
            </Button>

            <Button
                onClick={() => store.setActiveTab({ tab: 'structure' })}
                variant={
                    store.activeTab?.tab === 'structure' ? 'contained' : 'text'
                }
                color={
                    store.activeTab?.tab === 'structure' ? 'primary' : 'inherit'
                }
            >
                {_('Structure')}
            </Button>

            {/**
             * A chapter picker.
             *
             * Added because the app had no way into a chapter at all except double-clicking a
             * box on the timeline canvas — which means no keyboard route, no deep link, and
             * nothing to reach when the timeline is the view being rebuilt. The timeline keeps
             * its double-click; this is the route that does not depend on it.
             */}
            <Select
                size="small"
                displayEmpty
                value={
                    store.activeTab?.tab === 'chapter'
                        ? store.activeTab.chapterId
                        : ''
                }
                onChange={(event) =>
                    store.setActiveTab({
                        tab: 'chapter',
                        chapterId: event.target.value as TChapterId,
                    })
                }
                renderValue={(value) =>
                    value
                        ? register.chapters[value as TChapterId].title
                        : _('Open a chapter…')
                }
                sx={{ minWidth: 180, height: 36 }}
            >
                {Object.entries(register.chapters).map(([id, chapter]) => (
                    <MenuItem key={id} value={id}>
                        {chapter.title}
                    </MenuItem>
                ))}
            </Select>
        </Row>
    );
};
