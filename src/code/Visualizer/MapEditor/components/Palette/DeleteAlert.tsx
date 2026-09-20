import { Button, Tooltip } from '@mui/material';
import { Row, spacingCss } from '@story/ui';
import { MapStore } from '../../MapStore';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { List } from './List';
import styled from '@emotion/styled';

type Props = {
    mapStore: MapStore;
    onBack: () => void;
};

export const DeleteAlert = ({ mapStore, onBack }: Props) => {
    return (
        <>
            <SList>
                {_('Are you sure you want to delete color')}
                <b>{mapStore.data.palette[mapStore.selectedColorId]?.name}</b>
                {_('All tiles with that color will be set to None.')}
            </SList>
            <Row>
                <Tooltip title={_('Back')}>
                    <Button
                        variant="contained"
                        size="small"
                        onClick={onBack}
                        fullWidth
                    >
                        <ArrowBackIosNewRoundedIcon />
                    </Button>
                </Tooltip>
                <Tooltip title={_('Delete color')}>
                    <Button
                        variant="contained"
                        size="small"
                        color={'error'}
                        onClick={() => {
                            mapStore.deleteColor();
                            onBack();
                        }}
                        fullWidth
                    >
                        <DeleteRoundedIcon />
                    </Button>
                </Tooltip>
            </Row>
        </>
    );
};

const SList = styled(List)`
    padding: ${spacingCss(1)} ${spacingCss(2)};
    gap: ${spacingCss(2)};
    text-align: center;
`;
