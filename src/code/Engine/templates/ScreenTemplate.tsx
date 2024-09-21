import { styled } from '@mui/material';
import { WholeContainer } from 'code/Components/Basic';
import { TCharacterIdInEvent, TEventId } from 'types/TIds';
import { TPassageScreen } from 'types/TPassage';
import { StatusBar } from './Components/StatusBar';
import { Row } from 'code/Components/Basic';
import { spacingCss } from 'code/Components/css';
import { PassageLink } from './Components/PassageLink';

type Props<E extends TEventId> = {
    passage: TPassageScreen<E, TCharacterIdInEvent<E>>;
};

export const ScreenTemplate = ({ passage }: Props<TEventId>) => {
    const body = passage.body.filter((b) => b.condition);

    return (
        <WholeContainer>
            <StatusBar />
            <SContainer>
                <SImg src={passage.image} />
                <SContent>
                    <STitle>{passage.title}</STitle>
                    <SText>
                        {body.map((b) => (
                            <span>{b.text}</span>
                        ))}
                    </SText>
                    <SText>
                        {body.flatMap((b) => b.links.map((link) => <PassageLink link={link} />))}
                    </SText>
                </SContent>
            </SContainer>
        </WholeContainer>
    );
};

const SContainer = styled(Row)`
    width: 100%;
    flex: 1;
    padding: ${spacingCss(2)};
    gap: ${spacingCss(2)};
    overflow: hidden;
`;

const SImg = styled('img')`
    height: 100%;
    object-fit: contain;
    aspect-ratio: 1;
`;

const SContent = styled('div')`
    display: flex;
    flex-direction: column;
    padding: ${spacingCss(10)} 4%;
    flex: 1;
    gap: ${spacingCss(5)};
    overflow: auto;
`;

const STitle = styled('span')`
    font-size: 2em;
    line-height: 2em;
    text-align: center;
`;

const SText = styled('div')`
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: ${spacingCss(1)};
`;
