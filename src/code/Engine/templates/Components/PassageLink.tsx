import { css, styled } from '@mui/material';
import { useEngine } from 'code/Context';
import { itemInfo } from 'data/items/itemInfo';
import { TCharacterId, TEventId } from 'types/TIds';
import { TItemId } from 'types/TItem';
import { TPassageScreen } from 'types/TPassage';

export type TPassageScreenLink = TPassageScreen<
    TEventId,
    TCharacterId
>['body'][number]['links'][number];

type Props = {
    link: TPassageScreenLink;
};

export const PassageLink = ({ link }: Props) => {
    const e = useEngine();
    const cost = e.processor.parseCost(link.cost);

    const time = cost.time.s > 0 ? ` (${e.timeManager.renderDeltaTime(cost.time)})` : '';
    const items = cost.items && cost.items.length > 0 ? ` (${renderItems(cost.items)})` : '';
    const tools = cost.tools && cost.tools.length > 0 ? ` [${cost.tools.join(', ')}]` : '';

    const isActive = e.processor.isActionPossible(link.cost);

    return (
        <SLink $isDisabled={!isActive}>
            {link.text}
            {time}
            {items}
            {tools}
        </SLink>
    );
};

const renderItems = (items: { id: TItemId; count: number }[]) => {
    return items.map((item) => `${item.count} ${itemInfo[item.id].name}`).join(', ');
};

const SLink = styled('a')<{ $isDisabled: boolean }>`
    color: lime;
    cursor: pointer;
    text-decoration: none;

    &:hover,
    a:visited:hover {
        color: green;
    }

    ${({ $isDisabled }) =>
        $isDisabled
            ? css`
                  color: grey;
                  pointer-events: none;
              `
            : ''}
`;
