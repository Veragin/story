import { styled } from '@mui/material';
import { Column } from 'code/components/Basic';
import { spacingCss } from 'code/components/css';
import { useVisualizerStore } from 'code/Context';
import { observer } from 'mobx-react-lite';

export const InfoModal = observer(() => {
    const store = useVisualizerStore();
    if (store.modalContent === null) return null;

    return <StyledModal>{store.modalContent}</StyledModal>;
});

const StyledModal = styled(Column)`
    position: fixed;
    top: ${spacingCss(7)};
    right: ${spacingCss(1)};
    padding: ${spacingCss(2)};
    gap: ${spacingCss(1)};
    border-radius: 12px;
    background-color: #4f4f4f;
    z-index: 100;
`;
