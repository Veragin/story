import { observer } from 'mobx-react-lite';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';
import DeleteIcon from '@mui/icons-material/Delete';
import { TooltipIconButton } from '../../../../components/buttons/TooltipIconButton';
import { DiagnosticsList } from '../../../../components/feedback/DiagnosticsList';
import { FormFields } from '../../../../components/form/FormFields';
import { FormDescriptionInput } from '../../../../components/form/FormDescriptionInput';
import type { IEditorSource } from '../../../../components/layout/editorSource';
import { SaveControls } from '../../../../components/layout/SaveControls';
import { Sidebar } from '../../../../components/layout/Sidebar';
import { SidebarMeta } from '../../../../components/layout/SidebarMeta';
import { SidebarToolbar } from '../../../../components/layout/SidebarToolbar';
import type { TOption } from '../../../../structure/option';
import type { TVisualizerApi } from '../../../../api';
import type { PassageEditorStore } from '../PassageEditorStore';
import { PassageAlerts } from './PassageAlerts';
import { PassageFields } from './PassageFields';
import { PassageHeading } from './PassageHeading';
import type { TDiag, TPassageCreator } from './types';

type TProps = {
    store: PassageEditorStore;
    passageOptions: TOption[];
    passageCreator?: TPassageCreator;
    finishOptions: TOption[];
    itemOptions: TOption[];
    onClose: () => void;
    onDelete: () => void;
    onEditSource: () => void;
    deleteBlocker?: string;
    api?: TVisualizerApi;
};

export const PassageEditor = observer(
    ({
        store,
        passageOptions,
        passageCreator,
        finishOptions,
        itemOptions,
        onClose,
        onDelete,
        onEditSource,
        deleteBlocker,
        api,
    }: TProps) => {
        const { draft, base, diagnosticIndex } = store;
        const diag: TDiag = (path) => diagnosticIndex.byField.get(path) ?? [];
        const edit: typeof store.edit = (fn) => store.edit(fn);

        const source: IEditorSource = {
            dirty: store.dirty,
            saving: store.saving,
            stale: store.conflict,
            discard: () => store.reset(),
            save: () => store.save(),
        };

        return (
            <Sidebar label={_('Passage %s', base.passageId)}>
                <SidebarToolbar
                    start={
                        <>
                            <TooltipIconButton
                                title={deleteBlocker ?? _('Delete passage')}
                                icon={DeleteIcon}
                                tone="error"
                                disabled={store.saving || !!deleteBlocker}
                                onClick={onDelete}
                                data-action="delete"
                            />
                            <TooltipIconButton
                                title={_('Edit source')}
                                icon={CodeIcon}
                                tone="inherit"
                                onClick={onEditSource}
                                data-action="edit-source"
                            />
                        </>
                    }
                    end={
                        <>
                            <SaveControls store={source} />
                            <TooltipIconButton
                                title={_('Close')}
                                icon={CloseIcon}
                                tone="inherit"
                                onClick={onClose}
                                data-action="close"
                            />
                        </>
                    }
                />
                <PassageHeading draft={draft} edit={edit} />
                <DiagnosticsList diagnostics={diag('title')} />
                <SidebarMeta values={[base.passageId, base.file]} />
                <FormDescriptionInput
                    value={draft.docComment ?? ''}
                    onChange={(docComment) =>
                        edit((d) => (d.docComment = docComment))
                    }
                />
                <PassageAlerts store={store} onClose={onClose} />

                <FormFields>
                    <PassageFields
                        draft={draft}
                        edit={edit}
                        diag={diag}
                        passageOptions={passageOptions}
                        passageCreator={passageCreator}
                        finishOptions={finishOptions}
                        itemOptions={itemOptions}
                        api={api}
                        preamble={base.preamble}
                    />
                </FormFields>
            </Sidebar>
        );
    }
);
