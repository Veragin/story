import { styled } from '@mui/material';

export const Row = styled('div')`
    display: flex;
`;

export const Column = styled('div')`
    display: flex;
    flex-direction: column;
`;

export const WholeContainer = styled(Column)`
    width: 100vw;
    height: 100vh;
    align-items: stretch;
    overflow: hidden;
    background-color: #000;
    position: relative;
`;
