import { Button, styled, Tooltip } from '@mui/material';
import { spacingCss } from 'code/components/css';
import { Row } from 'code/components/Basic';
import { Text } from 'code/components/Text';
import { s } from 'worldState';
import { register } from 'data/register';
import { useState } from 'react';
import { Inventory } from './Inventory';
import InventoryIcon from '@mui/icons-material/Inventory';
import BoltIcon from '@mui/icons-material/Bolt';
import FavoriteIcon from '@mui/icons-material/Favorite';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import { observer } from 'mobx-react-lite';
import { useEngine } from 'code/Context';
import { Modal } from 'code/components/Modal';

export const StatusBar = observer(() => {
    const e = useEngine();
    const char = s.characters[s.mainCharacterId];
    const [openInventory, setOpenInventory] = useState(false);

    return (
        <SRow>
            <Text>{e.timeManager.renderTime(s.time, 'dateTime')}</Text>
            <Text>{register.characters[s.mainCharacterId].name}</Text>
            <Tooltip title="Health">
                <SStat>
                    <FavoriteIcon />
                    <Text>{Math.floor(char.health)}%</Text>
                </SStat>
            </Tooltip>
            <Tooltip title="Stamina">
                <SStat>
                    <BoltIcon />
                    <Text>{Math.floor(char.stamina)}%</Text>
                </SStat>
            </Tooltip>
            <Tooltip title="Hunger">
                <SStat>
                    <RestaurantIcon />
                    <Text>{Math.floor(char.hunger)}%</Text>
                </SStat>
            </Tooltip>

            <Tooltip title="Inventory">
                <Button onClick={() => setOpenInventory(true)}>
                    <InventoryIcon />
                </Button>
            </Tooltip>
            <Modal
                open={openInventory}
                onClose={() => setOpenInventory(false)}
                title="Inventory"
            >
                <Inventory />
            </Modal>

            <SButtons>
                <Button
                    variant="contained"
                    color="success"
                    onClick={() => e.saveStateToLocalStorage()}
                >
                    Save
                </Button>
                <Button
                    color="error"
                    onClick={() => {
                        e.clearStateFromLocalStorage();
                        window.location.reload();
                    }}
                >
                    Reset
                </Button>
            </SButtons>
        </SRow>
    );
});

export const SRow = styled(Row)`
    gap: ${spacingCss(3)};
    padding: ${spacingCss(0.5)} ${spacingCss(1)};
    border-bottom: solid 1px grey;
    align-items: center;
`;

export const SStat = styled(Row)`
    align-items: center;
    gap: ${spacingCss(0.5)};
    width: 90px;
`;

export const SButtons = styled(Row)`
    align-items: center;
    gap: ${spacingCss(1)};
    flex: 1;
    justify-content: flex-end;
`;
