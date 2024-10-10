import { styled } from '@mui/material';
import { WholeContainer } from 'code/Components/Basic';
import { StatusBar } from './Components/StatusBar';
import { Row } from 'code/Components/Basic';
import { spacingCss } from 'code/Components/css';
import { PassageLink } from './Components/PassageLink';
import { Header, Text } from 'code/Components/Text';
import { TUnkownPassageScreen } from '../ts/const';

type Props = {
    passage: TUnkownPassageScreen;
};

export const ScreenTemplate = ({ passage }: Props) => {
    const body = passage.body.filter((b) => b.condition !== false);
    const texts = body.flatMap((b) => b.text?.split('\n') ?? []);
    const links = body.flatMap((b) => b.links ?? []);

    return (
        <WholeContainer>
            <StatusBar />
            <SContainer>
                <SImg src={`${passage.eventId}/${passage.image}.png`} />
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
    gap: ${spacingCss(2)};
    overflow: hidden;
`;

const SImg = styled('img')`
    height: 100%;
    width: 50%;
    object-fit: cover;
    aspect-ratio: 1;
    pointer-events: none;
    user-select: none;
`;

const SContent = styled('div')`
    display: flex;
    flex-direction: column;
    padding: ${spacingCss(10)} 4%;
    flex: 1;
    gap: ${spacingCss(5)};
    overflow: auto;
`;

const SText = styled('div')`
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: ${spacingCss(2)};
`;
