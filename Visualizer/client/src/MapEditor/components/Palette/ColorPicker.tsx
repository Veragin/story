import styled from '@emotion/styled';
import { Row } from '@story/ui';
import type { MapStore } from '../../MapStore';
import { List } from './List';
import { Button, Tooltip } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { observer } from 'mobx-react-lite';
import { Color } from './Color';

type Props = {
    mapStore: MapStore;
    onAddNewColor: (id?: string) => void;
    onDeleteColor: () => void;
};
export const ColorPicker = observer(
    ({ mapStore, onAddNewColor, onDeleteColor }: Props) => {
        void mapStore.revision;
        const palette = mapStore.data?.palette ?? {};
        const colors = Object.keys(palette);

        return (
            <>
                <Row>
                    <Tooltip title={_('Add new color')}>
                        <SButton
                            variant="contained"
                            size="small"
                            color="success"
                            onClick={() => onAddNewColor()}
                            fullWidth
                        >
                            <AddRoundedIcon />
                        </SButton>
                    </Tooltip>
                    <Tooltip title={_('Edit color')}>
                        <SButton
                            variant="contained"
                            size="small"
                            onClick={() =>
                                onAddNewColor(mapStore.selectedColorId)
                            }
                            fullWidth
                        >
                            <EditRoundedIcon />
                        </SButton>
                    </Tooltip>
                    <Tooltip title={_('Delete color')}>
                        <SButton
                            variant="contained"
                            size="small"
                            color={'error'}
                            onClick={onDeleteColor}
                            fullWidth
                            disabled={mapStore.selectedColorId === 'none'}
                        >
                            <DeleteRoundedIcon />
                        </SButton>
                    </Tooltip>
                </Row>
                <List>
                    {colors.map((colorId) => (
                        <Color
                            key={colorId}
                            color={palette[colorId].color}
                            name={palette[colorId].name}
                            isActive={mapStore.selectedColorId === colorId}
                            onClick={() => {
                                mapStore.setSelectedColorId(colorId);
                            }}
                        />
                    ))}
                </List>
            </>
        );
    }
);

const SButton = styled(Button)`
    min-width: unset;
    border-radius: 0;
`;
