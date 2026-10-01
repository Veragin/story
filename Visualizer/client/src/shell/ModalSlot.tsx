import { observer } from 'mobx-react-lite';
import type { TModalEntry } from './modals';

// its own observer, so a modal that reads observables re-renders without the whole stack
export const ModalSlot = observer(({ entry }: { entry: TModalEntry }) => (
    <>{entry.render(entry.close)}</>
));
