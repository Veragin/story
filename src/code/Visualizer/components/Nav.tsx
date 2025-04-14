import { Button, styled } from '@mui/material';
import { Row } from 'code/components/Basic';
import { spacingCss } from 'code/components/css';
import { useVisualizerStore } from 'code/Context';

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
                {_('Event Timeline')}
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
        </Row>
    );
};
