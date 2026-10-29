import { observer } from 'mobx-react-lite';
import { FinishFields } from './FinishFields';
import { LinearFields } from './LinearFields';
import { RedirectFields } from './RedirectFields';
import { ScreenFields } from './ScreenFields';
import type { TFieldsProps } from './types';

export const PassageFields = observer(({ draft, ...rest }: TFieldsProps) => {
    if (draft.type === 'finish') {
        return <FinishFields draft={draft} {...rest} />;
    }
    if (draft.type === 'redirect') {
        return <RedirectFields draft={draft} {...rest} />;
    }
    if (draft.type === 'start' || draft.type === 'linear') {
        return <LinearFields draft={draft} {...rest} />;
    }
    return <ScreenFields draft={draft} {...rest} />;
});
