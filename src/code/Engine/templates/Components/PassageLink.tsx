import { styled } from '@mui/material';
import { TCharacterId, TEventId } from 'types/TCharacter';
import { TPassageScreen } from 'types/TPassage';

type Props = {
    link: TPassageScreen<TCharacterId, TEventId>['body'][number]['links'][number];
};

export const PassageLink = ({ link }: Props) => {
    return <SLink>{link.text}</SLink>;
};

const SLink = styled('a')`
    color: lime;
    cursor: pointer;
    text-decoration: none;

    &:hover,
    a:visited:hover {
        color: green;
    }

    &:disabled {
        color: grey;
        pointer-events: none;
    }
`;
