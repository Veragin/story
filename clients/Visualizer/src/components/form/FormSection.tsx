import type { ReactNode } from 'react';
import { styled, Typography } from '@mui/material';
import { spacingCss } from '@story/ui';
import { FormFields } from './FormFields';

type TProps = {
    title: string;
    actions?: ReactNode;
    children: ReactNode;
};

export const FormSection = ({ title, actions, children }: TProps) => (
    <SSection aria-label={title} data-form-section={title}>
        <SHeader>
            <Typography variant="subtitle2" component="h3">
                {title}
            </Typography>
            {actions}
        </SHeader>
        <FormFields>{children}</FormFields>
    </SSection>
);

const SSection = styled('section')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1)};
`;

const SHeader = styled('div')`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${spacingCss(1)};
`;
