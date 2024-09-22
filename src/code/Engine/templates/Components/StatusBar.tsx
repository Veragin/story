import { Button, Modal, styled, Tooltip } from '@mui/material';
import { spacingCss } from 'code/Components/css';
import { Row } from 'code/Components/Basic';
import { Text } from 'code/Components/Text';
import { TimeManager } from 'time/TimeManager';
import { s } from 'worldState';
import { register } from 'data/register';
import { useState } from 'react';
import { Inventory } from './Inventory';
import { InventoryRounded } from '@mui/icons-material';

export const StatusBar = () => {
    const timeManager = new TimeManager();
    const char = s.characters[s.mainCharacterId];
    const [openInventory, setOpenInventory] = useState(false);

    return (
        <SRow>
            <Text>{timeManager.renderTime(s.time, 'dateTime')}</Text>
            <Text>{register.characters[s.mainCharacterId].name}</Text>
            <Text>Stamina: {char.stamina} %</Text>
            <Text>Hunger: {char.hunger} %</Text>
            <Tooltip title="Inventory">
                <Button onClick={() => setOpenInventory(true)}>
                    <InventoryRounded />
                </Button>
            </Tooltip>
            <Modal open={openInventory} onClose={() => setOpenInventory(false)}>
                <Inventory onClose={() => setOpenInventory(false)} />
            </Modal>
        </SRow>
    );
};

export const SRow = styled(Row)`
    gap: ${spacingCss(1)};
    padding: ${spacingCss(0.5)} ${spacingCss(1)};
    border-bottom: solid 1px grey;
`;
