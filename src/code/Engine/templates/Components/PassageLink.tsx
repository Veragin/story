import { styled } from '@mui/material';
import { TCharacterIdInEvent, TEventId } from 'types/TIds';
import { TPassageScreen } from 'types/TPassage';

export type TPassageScreenLink<E extends TEventId> = TPassageScreen<
    E,
    TCharacterIdInEvent<E>
>['body'][number]['links'][number];

type Props<E extends TEventId> = {
    link: TPassageScreenLink<E>;
};

export const PassageLink = ({ link }: Props<TEventId>) => {
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
