import { observer } from 'mobx-react-lite';
import { LinearFields } from './LinearFields';
import { ScreenFields } from './ScreenFields';
import { TransitionFields } from './TransitionFields';
import type { TFieldsProps } from './types';

export const PassageFields = observer(({ draft, ...rest }: TFieldsProps) => {
    if (draft.type === 'transition') {
        return <TransitionFields draft={draft} {...rest} />;
    }
    if (draft.type === 'linear') {
        return <LinearFields draft={draft} {...rest} />;
    }
    return <ScreenFields draft={draft} {...rest} />;
});
