import { styled, Paper, Box, FormControl } from '@mui/material';
import { Column, Row, spacingCss } from '@story/ui';

export const SFormContainer = styled(Paper)(
    ({ theme }) => `
    padding: ${spacingCss(1.5)};
    max-width: 1000px;
    margin: 0 auto;
    background-color: ${theme.palette.background.paper};
    color: ${theme.palette.text.primary};
    font-size: 0.875rem;
`
);

export const SHeader = styled(Box)(
    ({ theme }) => `
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
`
);

export const SFormContent = styled(Column)`
    gap: ${spacingCss(1.5)};
`;

export const SFormRow = styled(Row)`
    width: 100%;
`;

export const SButtonRow = styled(Row)`
    gap: ${spacingCss(1.5)};
    justify-content: flex-end;
    margin-top: ${spacingCss(2)};
`;

export const SFormControl = styled(FormControl)(
    ({ theme }) => `
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
`
);

export const SBodyItemContainer = styled(Box)(
    ({ theme }) => `
    border: 1px solid ${theme.palette.divider};
    border-radius: 6px;
    margin-bottom: ${spacingCss(1)};
    background-color: ${theme.palette.background.default};
    
    & .MuiAccordionSummary-root {
        min-height: 40px;
        padding: ${spacingCss(0.5)} ${spacingCss(1)};
        
        & .MuiTypography-subtitle1 {
            font-size: 0.9rem;
            font-weight: 500;
        }
    }
    
    & .MuiAccordionDetails-root {
        padding: ${spacingCss(1)};
    }
`
);

export const SLinkContainer = styled(Box)(
    ({ theme }) => `
    padding: ${spacingCss(1)};
    border: 1px solid ${theme.palette.divider};
    border-radius: 4px;
    margin-bottom: ${spacingCss(0.75)};
    background-color: ${theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100]};
`
);

export const SCostSection = styled(Box)(
    ({ theme }) => `
    padding: ${spacingCss(1)};
    border: 1px solid ${theme.palette.divider};
    border-radius: 4px;
    background-color: ${theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50]};
    margin-top: ${spacingCss(0.75)};
    
    & .MuiTypography-subtitle2 {
        font-size: 0.8rem;
        font-weight: 500;
    }
    
    & .MuiTypography-caption {
        font-size: 0.7rem;
    }
`
);

export const SCostCard = styled(Box)(
    ({ theme }) => `
    padding: ${spacingCss(1)};
    border: 1px solid ${theme.palette.divider};
    border-radius: 4px;
    background-color: ${theme.palette.background.paper};
    margin-bottom: ${spacingCss(0.75)};
`
);

export const SCompactRow = styled(Row)`
    gap: ${spacingCss(0.75)};
    align-items: center;
`;

export const SCompactColumn = styled(Column)`
    gap: ${spacingCss(0.75)};
`;
