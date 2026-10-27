import styled from '@emotion/styled';
import { Button } from '@mui/material';
import { Row, spacingCss } from '@story/ui';
import type { MapStore } from '../../MapStore';
import { ToolSection } from '../ToolWindow/ToolSection';

type Props = {
    mapStore: MapStore;
    onBack: () => void;
};

export const DeleteAlert = ({ mapStore, onBack }: Props) => (
    <ToolSection label={_('Delete tile type')}>
        <SText>
            {_('Are you sure you want to delete tile type')}{' '}
            <b>{mapStore.data?.palette[mapStore.selectedColorId]?.name}</b>?{' '}
            {_('All tiles of that type will be set to None.')}
        </SText>
        <SButtons>
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
        </SButtons>
    </ToolSection>
);

const SText = styled.span`
    line-height: 1.5;
`;

const SButtons = styled(Row)`
    justify-content: flex-end;
    gap: ${spacingCss(1)};
`;
