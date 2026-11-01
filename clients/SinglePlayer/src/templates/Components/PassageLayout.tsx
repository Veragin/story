import type { ReactNode } from 'react';
import { styled } from '@mui/material';
import { imageDescription } from '@story/shared';
import { Row, spacingCss, WholeContainer } from '@story/ui';
import { passageImage } from '../../images';
import { StatusBar } from './StatusBar';

type Props = {
    passage: Parameters<typeof passageImage>[0];
    children: ReactNode;
};

export const PassageLayout = ({ passage, children }: Props) => {
    const image = passageImage(passage);
    const description = imageDescription(passage.image);
    return (
        <WholeContainer>
            <StatusBar />
            <SContainer>
                {image && (
                    <SImg
                        src={image}
                        alt={description}
                        title={description || undefined}
                    />
                )}
                <SContent>{children}</SContent>
            </SContainer>
        </WholeContainer>
    );
};

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
