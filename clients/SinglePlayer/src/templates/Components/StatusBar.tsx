import { Avatar, Button, styled, Tooltip } from '@mui/material';
import { Modal, Row, spacingCss, Text } from '@story/ui';
import { useState } from 'react';
import { Inventory } from './Inventory/Inventory';
import InventoryIcon from '@mui/icons-material/Inventory';
import { observer } from 'mobx-react-lite';
import { useEngine, useWorldState } from '../../context';
import { characterImage } from '../../images';
import { restartGame } from '../../restartGame';
import { StoryTopbar } from './Topbar/StoryTopbar';

export const StatusBar = observer(() => {
    const e = useEngine();
    const s = useWorldState();
    const [openInventory, setOpenInventory] = useState(false);
    const character = e.storyModule.register.characters[s.mainCharacterId];
    const portrait = characterImage(s.mainCharacterId);

    return (
        <SRow>
            <Text>{e.timeManager.renderTime(s.time, 'dateTime')}</Text>
            <SCharacter>
                {portrait && (
                    <Avatar
                        src={portrait}
                        alt={character.image ?? character.name}
                        sx={{ width: 28, height: 28 }}
                    />
                )}
                <Text>{character.name}</Text>
            </SCharacter>
            <SStats>
                <StoryTopbar />
            </SStats>

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
                <Button color="error" onClick={() => restartGame(e)}>
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
    flex-wrap: wrap;
    row-gap: ${spacingCss(0.5)};
`;

export const SCharacter = styled(Row)`
    align-items: center;
    gap: ${spacingCss(1)};
`;

export const SStats = styled(Row)`
    align-items: center;
    gap: ${spacingCss(2)};
    flex-wrap: wrap;
`;

export const SButtons = styled(Row)`
    align-items: center;
    gap: ${spacingCss(1)};
    flex: 1;
    justify-content: flex-end;
`;
