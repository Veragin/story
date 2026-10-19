import { observer } from 'mobx-react-lite';
import type { TOption } from '../../../../components/inputs/inputTypes';
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
    passageOptions: TOption[];
    transitionOptions: TOption[];
    itemOptions: TOption[];
    onClose: () => void;
    onDelete: () => void;
    onEditSource: () => void;
    api?: TVisualizerApi;
};

export const PassageEditor = observer(
    ({
        store,
        passageOptions,
        transitionOptions,
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
                        transitionOptions={transitionOptions}
                        itemOptions={itemOptions}
                        api={api}
                        preamble={base.preamble}
                    />
                </SFields>
            </SPanel>
        );
    }
);
