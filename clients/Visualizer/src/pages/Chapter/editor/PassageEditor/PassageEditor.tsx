import { observer } from 'mobx-react-lite';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';
import { TooltipIconButton } from '../../../../components/buttons/TooltipIconButton';
import {
    EditorHeader,
    type IEditorSource,
} from '../../../../components/layout/EditorHeader';
import type { TOption } from '../../../../structure/option';
import type { TVisualizerApi } from '../../../../api';
import type { PassageEditorStore } from '../PassageEditorStore';
import { PassageAlerts } from './PassageAlerts';
import { PassageFields } from './PassageFields';
import { FormFields } from '../../../../components/form/FormFields';
import { SPanel } from './styles';
import type { TDiag } from './types';

type TProps = {
    store: PassageEditorStore;
    passageOptions: TOption[];
    finishOptions: TOption[];
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
        finishOptions,
        itemOptions,
        onClose,
        onDelete,
        onEditSource,
        api,
    }: TProps) => {
        const { draft, base, diagnosticIndex } = store;
        const diag: TDiag = (path) => diagnosticIndex.byField.get(path) ?? [];

        const source: IEditorSource = {
            dirty: store.dirty,
            saving: store.saving,
            stale: store.conflict,
            discard: () => store.reset(),
            save: () => store.save(),
        };

        return (
            <SPanel elevation={0}>
                <EditorHeader
                    compact
                    title={base.passageId}
                    chip={base.type}
                    subtitle={base.file}
                    store={source}
                    onDelete={onDelete}
                    deleteLabel={_('Delete passage')}
                    actions={
                        <>
                            <TooltipIconButton
                                title={_('Edit source')}
                                icon={CodeIcon}
                                onClick={onEditSource}
                            />
                            <TooltipIconButton
                                title={_('Close')}
                                icon={CloseIcon}
                                onClick={onClose}
                            />
                        </>
                    }
                />
                <PassageAlerts store={store} onClose={onClose} />

                <FormFields>
                    <PassageFields
                        draft={draft}
                        edit={(fn) => store.edit(fn)}
                        diag={diag}
                        passageOptions={passageOptions}
                        finishOptions={finishOptions}
                        itemOptions={itemOptions}
                        api={api}
                        preamble={base.preamble}
                    />
                </FormFields>
            </SPanel>
        );
    }
);
