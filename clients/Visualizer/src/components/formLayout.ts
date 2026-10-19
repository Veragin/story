import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';

export const FormPage = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1.5)};
    padding: ${spacingCss(2)} ${spacingCss(3)} ${spacingCss(6)};
    max-width: 920px;
`;

export const FormMeta = styled('div')`
    display: flex;
    flex-wrap: wrap;
    gap: ${spacingCss(2)};
    font-size: 12px;
    color: ${({ theme }) => theme.palette.text.secondary};
    & code {
        color: ${({ theme }) => theme.palette.text.primary};
    }
`;

export const FormFields = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(2)};
`;

export const FormCenter = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(2)};
    align-items: center;
    justify-content: center;
    padding: ${spacingCss(6)};
    color: ${({ theme }) => theme.palette.text.secondary};
`;
