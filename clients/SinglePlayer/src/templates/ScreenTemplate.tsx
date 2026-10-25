import { styled } from '@mui/material';
import { Header, Row, spacingCss, Text, WholeContainer } from '@story/ui';
import { StatusBar } from './Components/StatusBar';
import { PassageLink } from './Components/PassageLink';
import { TUnkownPassageScreen } from '@story/core';
import { passageImage } from '../images';

type Props = {
    passage: TUnkownPassageScreen;
};

export const ScreenTemplate = ({ passage }: Props) => {
    const body = passage.body.filter((b) => b.condition !== false);
    const texts = body.flatMap((b) => b.text?.split('\n') ?? []);
    const links = body.flatMap((b) => b.links ?? []);
    const image = passageImage(passage);

    return (
        <WholeContainer>
            <StatusBar />
            <SContainer>
                {image && (
                    <SImg
                        src={image}
                        alt={passage.image}
                        title={passage.image || undefined}
                    />
                )}
                <SContent>
                    <Header>{passage.title}</Header>
                    <SText>
                        {texts.map((t, i) => (
                            <Text key={i}>{t}</Text>
                        ))}
                    </SText>
                    <SText>
                        {links.map((link, j) => (
                            <PassageLink key={j} link={link} />
                        ))}
                    </SText>
                </SContent>
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

const SText = styled('div')`
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: ${spacingCss(2)};
`;
