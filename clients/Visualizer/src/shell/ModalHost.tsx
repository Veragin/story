import { observer } from 'mobx-react-lite';
import { modals } from './modals';
import { ModalSlot } from './ModalSlot';

export const ModalHost = observer(() => (
    <>
        {modals.stack.map((m) => (
            <ModalSlot key={m.id} entry={m} />
        ))}
    </>
));
