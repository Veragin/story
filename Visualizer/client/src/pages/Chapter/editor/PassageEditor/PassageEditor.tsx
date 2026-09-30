import { observer } from 'mobx-react-lite';
import type { TOption } from '../../../../components/CodeField';
import type { TVisualizerApi } from '../../../../api';
import { useKey } from '../../../../shell';
import type { PassageEditorStore } from '../PassageEditorStore';
import { PassageAlerts } from './PassageAlerts';
import { PassageFields } from './PassageFields';
import { PassageHeader } from './PassageHeader';
import { SFields, SPanel } from './styles';
import type { TDiag } from './types';

type TProps = {
    store: PassageEditorStore;
    /** Passage ids offered by the pickers (the chapter's passages). */
    passageOptions: TOption[];
    itemOptions: TOption[];
    onClose: () => void;
    onDelete: () => void;
    /** Open the passage's whole file in the source editor. */
    onEditSource: () => void;
    /** The api the passage's image is loaded / uploaded through (the page's). */
    api?: TVisualizerApi;
};

/**
 * The passage editor side panel (plan WP6): every field of the passage, literal fields as
 * inputs and expression fields as code (`CodeField`). Saves through `PUT /passages/:id`
 * with only the changed fields, shows 422 diagnostics next to their fields (the ones it cannot
 * place at the top) and the "changed on disk — reload / keep mine" banner on 409 or when a
 * live change arrives while the draft is dirty.
 */
export const PassageEditor = observer(
    ({
        store,
        passageOptions,
        itemOptions,
        onClose,
        onDelete,
        onEditSource,
        api,
    }: TProps) => {
        const { draft, base, diagnosticIndex } = store;
        const diag: TDiag = (path) => diagnosticIndex.byField.get(path) ?? [];

        useKey('mod+s', () => (void store.save(), true), {
            allowInInputs: true,
        });

        return (
            <SPanel elevation={0}>
                <PassageHeader
                    store={store}
                    onClose={onClose}
                    onDelete={onDelete}
                    onEditSource={onEditSource}
                />
                <PassageAlerts store={store} onClose={onClose} />

                <SFields>
                    <PassageFields
                        draft={draft}
                        edit={(fn) => store.edit(fn)}
                        diag={diag}
                        passageOptions={passageOptions}
                        itemOptions={itemOptions}
                        api={api}
                        preamble={base.preamble}
                    />
                </SFields>
            </SPanel>
        );
    }
);
