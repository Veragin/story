import { styled } from '@mui/material';
import { WholeContainer } from 'Components/Basic';
import { TCharacterId, TEventId } from 'types/TCharacter';
import { TPassageScreen } from 'types/TPassage';
import { StatusBar } from './Components/StatusBar';
import { Row } from 'Components/Basic';

type Props = {
    passage: TPassageScreen<TCharacterId, TEventId>;
};

export const ScreenTemplate = ({ passage }: Props) => {
    return (
        <WholeContainer>
            <StatusBar />
            <SContainer></SContainer>
        </WholeContainer>
    );
};

const SContainer = styled(Row)`
    align-items: center;
    justify-content: center;
    padding: 20px;
`;
