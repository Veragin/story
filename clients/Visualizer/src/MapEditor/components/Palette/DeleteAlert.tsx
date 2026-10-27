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
    <ToolSection label={_('Delete color')}>
        <SText>
            {_('Are you sure you want to delete color')}{' '}
            <b>{mapStore.data?.palette[mapStore.selectedColorId]?.name}</b>?{' '}
            {_('All tiles with that color will be set to None.')}
        </SText>
        <SButtons>
            <Button size="small" color="inherit" onClick={onBack}>
                {_('Back')}
            </Button>
            <Button
                size="small"
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
