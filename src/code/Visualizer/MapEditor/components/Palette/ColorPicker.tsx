import styled from '@emotion/styled';
import { Row } from 'code/components/Basic';
import { spacingCss } from 'code/components/css';
import { MapStore } from '../../MapStore';
import { List } from './List';
import { Button, Tooltip } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { observer } from 'mobx-react-lite';

type Props = {
    mapStore: MapStore;
    onAddNewColor: (id?: string) => void;
    onDeleteColor: () => void;
};
export const ColorPicker = observer(
    ({ mapStore, onAddNewColor, onDeleteColor }: Props) => {
        const palette = mapStore.data.palette;
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

type TColorProps = {
    name: string;
    color: string;
    isActive: boolean;
    onClick: () => void;
};

const Color = ({ color, isActive, name, onClick }: TColorProps) => {
    return (
        <SRow
            $isActive={isActive}
            onClick={onClick}
            onWheel={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
        >
            <SColor color={color}></SColor>
            <span>{name}</span>
        </SRow>
    );
};

const SRow = styled(Row)<{ $isActive: boolean }>`
    background-color: ${({ $isActive }) => ($isActive ? '#444' : '#000')};
    color: ${({ $isActive }) => ($isActive ? '#fff' : '#ddd')};
    &:hover {
        background-color: #333;
    }
    padding: ${spacingCss(0.5)};
    gap: ${spacingCss(0.5)};
    cursor: pointer;
    align-self: stretch;
`;

const SColor = styled.div<{ color: string }>`
    background-color: ${({ color }) => color};
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid #000;
`;
