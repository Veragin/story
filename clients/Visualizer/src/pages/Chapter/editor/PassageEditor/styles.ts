import { Paper, styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import { AddButton } from '../../../../components/buttons/AddButton';

export const SPanel = styled(Paper)`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1.25)};
    min-height: 100%;
    padding: ${spacingCss(1.5)};
    box-sizing: border-box;
    background: transparent;
`;

export const STitleRow = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(0.75)};
`;

export const SSpacer = styled('span')`
    flex: 1;
`;

export const SItem = styled(Paper)`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1)};
    padding: ${spacingCss(1)} ${spacingCss(1.25)};
    background: rgba(255, 255, 255, 0.03);
`;

export const SLink = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.75)};
    padding: ${spacingCss(0.75)} 0 ${spacingCss(0.75)} ${spacingCss(1.25)};
    border-left: 3px solid rgba(100, 181, 246, 0.5);
`;

export const SAddButton = styled(AddButton)`
    align-self: flex-start;
`;
