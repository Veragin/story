import { styled, Paper, Box, FormControl } from '@mui/material';
import { Column, Row } from 'code/components/Basic';
import { spacingCss } from 'code/components/css';

export const SFormContainer = styled(Paper)(({ theme }) => `
    padding: ${spacingCss(1.5)};
    max-width: 800px;
    margin: 0 auto;
    background-color: ${theme.palette.background.paper};
    color: ${theme.palette.text.primary};
    font-size: 0.875rem;
`);

export const SHeader = styled(Box)(({ theme }) => `
    margin-bottom: ${spacingCss(1.5)};
    border-bottom: 1px solid ${theme.palette.divider};
    padding-bottom: ${spacingCss(1)};
    
    & h6 {
        font-size: 1.1rem;
        font-weight: 500;
    }
    
    & .MuiTypography-body2 {
        font-size: 0.8rem;
    }
`);

export const SFormContent = styled(Column)`
    gap: ${spacingCss(1.5)};
`;

export const SFormRow = styled(Row)`
    width: 100%;
    gap: ${spacingCss(1)};
`;

export const SButtonRow = styled(Row)`
    gap: ${spacingCss(1.5)};
    justify-content: flex-end;
    margin-top: ${spacingCss(2)};
`;

export const SFormControl = styled(FormControl)(({ theme }) => `
    min-width: 200px;

    & .MuiInputLabel-root {
        font-size: 0.875rem;
        color: ${theme.palette.text.secondary};

        &.Mui-focused {
            color: ${theme.palette.primary.main};
        }
    }

    & .MuiOutlinedInput-root {
        font-size: 0.875rem;
        
        & .MuiOutlinedInput-notchedOutline {
            border-color: ${theme.palette.divider};
        }

        &:hover .MuiOutlinedInput-notchedOutline {
            border-color: ${theme.palette.text.primary};
        }

        &.Mui-focused .MuiOutlinedInput-notchedOutline {
            border-color: ${theme.palette.primary.main};
        }
    }

    & .MuiFormHelperText-root {
        font-size: 0.75rem;
        margin-top: ${spacingCss(0.5)};
    }

    & .MuiSelect-select {
        font-size: 0.875rem;
    }

    & .MuiMenuItem-root {
        font-size: 0.875rem;
    }
`);

export const SSectionContainer = styled(Box)(({ theme }) => `
    border: 1px solid ${theme.palette.divider};
    border-radius: 6px;
    padding: ${spacingCss(1.5)};
    background-color: ${theme.palette.background.default};
`);

export const STimeRangeContainer = styled(Box)(({ theme }) => `
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1)};
    
    @media (min-width: 600px) {
        flex-direction: row;
        align-items: flex-start;
    }
`);

export const STimeInputGroup = styled(Box)`
    flex: 1;
    min-width: 200px;
`;

export const SDurationDisplay = styled(Box)(({ theme }) => `
    padding: ${spacingCss(1)};
    border: 1px solid ${theme.palette.divider};
    border-radius: 4px;
    background-color: ${theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50]};
    text-align: center;
    
    & .MuiTypography-caption {
        font-size: 0.7rem;
        color: ${theme.palette.text.secondary};
    }
    
    & .duration-value {
        font-size: 0.9rem;
        font-weight: 500;
        color: ${theme.palette.primary.main};
    }
    
    @media (min-width: 600px) {
        min-width: 120px;
        flex: 0 0 auto;
    }
`);
