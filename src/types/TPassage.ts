import { TItemId } from './TItem';

export type TPassage<RegisterPassageId> = () => {
    id: RegisterPassageId;
    eventId: number;
    title: string;
    image: string;

    data: TPassageScreen<RegisterPassageId> | TPassageFight<RegisterPassageId>;
};

type TPassageScreen<RegisterPassageId> = {
    type: 'screen';
    body: {
        condition: boolean;
        text: string;
        links: {
            passageId: RegisterPassageId;
            cost:
                | number
                | {
                      time?: number;
                      items?: { id: TItemId; count: number }[];
                      tools?: TItemId[];
                  }[];
            callback?: () => void;
        }[];
    }[];
};

type TPassageFight<RegisterPassageId> = {
    type: 'fight';
};
