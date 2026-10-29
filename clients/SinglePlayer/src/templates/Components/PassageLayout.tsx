import type { ReactNode } from 'react';
import { styled } from '@mui/material';
import { Row, spacingCss, WholeContainer } from '@story/ui';
import { StatusBar } from './StatusBar';

type Props = {
    image: string | undefined;
    imageName?: string;
    children: ReactNode;
};

export const PassageLayout = ({ image, imageName, children }: Props) => (
    <WholeContainer>
        <StatusBar />
        <SContainer>
            {image && (
                <SImg
                    src={image}
                    alt={imageName ?? ''}
                    title={imageName || undefined}
                />
            )}
            <SContent>{children}</SContent>
        </SContainer>
    </WholeContainer>
);

const SContainer = styled(Row)`
    width: 100%;
    flex: 1;
    min-height: 0;
    gap: ${spacingCss(2)};
    overflow: hidden;

    ${({ theme }) => theme.breakpoints.down('sm')} {
        flex-direction: column;
        overflow: auto;
    }
`;

const SImg = styled('img')`
    height: 100%;
    width: 50%;
    object-fit: cover;
    aspect-ratio: 1;
    pointer-events: none;
    user-select: none;

    ${({ theme }) => theme.breakpoints.down('sm')} {
        flex-shrink: 0;
        width: 100%;
        height: auto;
        max-height: 40vh;
    }
`;

const SContent = styled('div')`
    display: flex;
    flex-direction: column;
    padding: ${spacingCss(10)} 4%;
    flex: 1;
    gap: ${spacingCss(5)};
    overflow: auto;

    ${({ theme }) => theme.breakpoints.down('sm')} {
        padding: ${spacingCss(2)} 4%;
        gap: ${spacingCss(3)};
        overflow: visible;
    }
`;
