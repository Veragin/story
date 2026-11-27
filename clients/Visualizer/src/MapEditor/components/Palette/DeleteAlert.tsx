import { Button, styled } from '@mui/material';
import type { MapStore } from '../../MapStore';
import { ActionRow } from '../../../components/layout/ActionRow';
import { PanelSection } from '../../../components/layout/PanelSection';

type TProps = {
    mapStore: MapStore;
    onBack: () => void;
};

export const DeleteAlert = ({ mapStore, onBack }: TProps) => (
    <PanelSection label={_('Delete tile type')}>
        <SText>
            {_('Are you sure you want to delete tile type')}{' '}
            <b>{mapStore.data?.palette[mapStore.selectedColorId]?.name}</b>?{' '}
            {_('All tiles of that type will be set to None.')}
        </SText>
        <ActionRow>
            <Button color="inherit" onClick={onBack}>
                {_('Cancel')}
            </Button>
            <Button
                variant="contained"
                color="error"
                onClick={() => {
                    mapStore.deleteColor();
                    onBack();
                }}
            >
                {_('Delete')}
            </Button>
        </ActionRow>
    </PanelSection>
);

const SText = styled('span')`
    line-height: 1.5;
`;
