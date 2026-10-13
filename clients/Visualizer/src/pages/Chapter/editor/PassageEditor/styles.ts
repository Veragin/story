import { Paper, styled } from '@mui/material';

export const SPanel = styled(Paper)`
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 100%;
    padding: 12px;
    box-sizing: border-box;
    background: transparent;
`;

export const SHeader = styled('div')`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

export const STitleRow = styled('div')`
    display: flex;
    align-items: center;
    gap: 6px;
`;

export const SButtons = styled('div')`
    display: flex;
    align-items: center;
    gap: 6px;
`;

export const SSpacer = styled('span')`
    flex: 1;
`;

export const SFields = styled('div')`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

export const SItem = styled(Paper)`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
`;

export const SLink = styled('div')`
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px 0 6px 10px;
    border-left: 3px solid rgba(100, 181, 246, 0.5);
`;

export const SList = styled('ul')`
    margin: 0;
    padding-left: 16px;
`;
