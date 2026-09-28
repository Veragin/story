import { observer } from 'mobx-react-lite';
import { modals, TModalEntry } from './modals';

/** Renders the modal stack. The shell mounts it once; later entries render on top. */
export const ModalHost = observer(() => (
    <>
        {modals.stack.map((m) => (
            <ModalSlot key={m.id} entry={m} />
        ))}
    </>
));

// Its own observer, so a modal that reads observables re-renders without the whole stack.
const ModalSlot = observer(({ entry }: { entry: TModalEntry }) => (
    <>{entry.render(entry.close)}</>
));
