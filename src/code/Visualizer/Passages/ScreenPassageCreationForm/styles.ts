import { styled, Paper, Box, FormControl } from '@mui/material';
import { Column, Row } from 'code/components/Basic';
import { spacingCss } from 'code/components/css';

export const SFormContainer = styled(Paper)(({ theme }) => `
    padding: ${spacingCss(2)};
    max-width: 1000px;
    margin: 0 auto;
    background-color: ${theme.palette.background.paper};
    color: ${theme.palette.text.primary};
`);

export const SHeader = styled(Box)(({ theme }) => `
    margin-bottom: ${spacingCss(2)};
    border-bottom: 1px solid ${theme.palette.divider};
    padding-bottom: ${spacingCss(1.5)};
`);

export const SFormContent = styled(Column)`
    gap: ${spacingCss(2)};
`;

export const SFormRow = styled(Row)`
    width: 100%;
`;

export const SButtonRow = styled(Row)`
    gap: ${spacingCss(2)};
    justify-content: flex-end;
    margin-top: ${spacingCss(3)};
`;

export const SFormControl = styled(FormControl)(({ theme }) => `
    min-width: 200px;

    & .MuiOutlinedInput-notchedOutline {
        border-color: ${theme.palette.divider};
    }

    & .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline {
        border-color: ${theme.palette.text.primary};
    }

    & .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline {
        border-color: ${theme.palette.primary.main};
    }

    & .MuiInputLabel-root {
        color: ${theme.palette.text.secondary};

        &.Mui-focused {
            color: ${theme.palette.primary.main};
        }
    }
`);

export const SBodyItemContainer = styled(Box)(({ theme }) => `
    border: 1px solid ${theme.palette.divider};
    border-radius: 8px;
    margin-bottom: ${spacingCss(1.5)};
    background-color: ${theme.palette.background.default};
`);

export const SLinkContainer = styled(Box)(({ theme }) => `
    padding: ${spacingCss(1.5)};
    border: 1px solid ${theme.palette.divider};
    border-radius: 6px;
    margin-bottom: ${spacingCss(1)};
    background-color: ${theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100]};
`);

export const SCostSection = styled(Box)(({ theme }) => `
    padding: ${spacingCss(1.5)};
    border: 1px solid ${theme.palette.divider};
    border-radius: 4px;
    background-color: ${theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50]};
    margin-top: ${spacingCss(1)};
`);

export const SCostCard = styled(Box)(({ theme }) => `
    padding: ${spacingCss(1.5)};
    border: 1px solid ${theme.palette.divider};
    border-radius: 4px;
    background-color: ${theme.palette.background.paper};
    margin-bottom: ${spacingCss(1)};
`);

export const SCompactRow = styled(Row)`
    gap: ${spacingCss(1)};
    align-items: center;
`;

export const SCompactColumn = styled(Column)`
    gap: ${spacingCss(1)};
`;