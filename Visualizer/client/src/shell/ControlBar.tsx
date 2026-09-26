import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { observer } from 'mobx-react-lite';
import { shell } from './shellStore';

/**
 * The right-hand part of the top bar belongs to the current page. A page fills it by rendering
 * `<ControlBar>` anywhere in its tree; the children are portalled into the top bar:
 *
 *   export default function TimelinePage() {
 *       return (
 *           <>
 *               <ControlBar>
 *                   <CharacterSelect />
 *                   <Button onClick={add}>{_('Add')}</Button>
 *               </ControlBar>
 *               <TimelineCanvas />
 *           </>
 *       );
 *   }
 *
 * The contents live in the page's React tree (context, state and MobX all work as usual) and
 * disappear when the page unmounts. Render at most one `<ControlBar>` per page; several are
 * allowed and are shown side by side in render order.
 */

export const ControlBar = observer(({ children }: { children: ReactNode }) => {
    const target = shell.controlBarEl;
    if (!target) return null;
    return createPortal(children, target);
});
