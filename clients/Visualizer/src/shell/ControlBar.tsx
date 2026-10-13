import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { observer } from 'mobx-react-lite';
import { shell } from './shellStore';

export const ControlBar = observer(({ children }: { children: ReactNode }) => {
    const target = shell.controlBarEl;
    if (!target) return null;
    return createPortal(children, target);
});
