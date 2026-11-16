import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import { CopyableText } from './CopyableText';

type TProps = {
    values: readonly (string | undefined)[];
};

export const SidebarMeta = ({ values }: TProps) => (
    <SMeta>
        {values
            .flatMap((value) => (value ? [value] : []))
            .map((value) => (
                <CopyableText key={value} value={value} />
            ))}
    </SMeta>
);

const SMeta = styled('div')`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: ${spacingCss(0.25)};
    margin-top: ${spacingCss(-0.75)};
    font-size: ${({ theme }) => theme.typography.meta.fontSize};
    color: ${({ theme }) => theme.palette.text.secondary};
`;
