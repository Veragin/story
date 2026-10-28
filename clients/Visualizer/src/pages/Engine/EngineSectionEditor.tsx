import { Button, styled } from '@mui/material';
import Code from '@mui/icons-material/Code';
import { observer } from 'mobx-react-lite';
import type { TEngineSectionDto } from '@story/protocol';
import { spacingCss } from '@story/ui';
import { CodeEditor } from '../../components/code/CodeEditor';
import { EditorHeader } from '../../components/layout/EditorHeader';
import {
    FormCenter,
    FormMeta,
    FormPage,
} from '../../components/layout/formLayout';
import { FormFields } from '../../components/form/FormFields';
import { FormSection } from '../../components/form/FormSection';
import { FormTextInput } from '../../components/form/FormTextInput';
import { HintText } from '../../components/feedback/HintText';
import { LoadingState } from '../../components/feedback/LoadingState';
import { Notices } from '../../components/feedback/Notices';
import { modals } from '../../shell';
import type { EngineEditorStore } from './EngineEditorStore';
import { ENGINE_SECTION_INFO } from './engineSections';

type TProps = {
    editor: EngineEditorStore;
};

const stateText = (base: TEngineSectionDto) => {
    if (!base.exists) return _('Not set: the default is used.');
    return base.implemented
        ? _('Implemented')
        : _('Described, not implemented yet');
};

export const EngineSectionEditor = observer(({ editor }: TProps) => {
    const { resource } = editor;
    const { base, draft } = resource;
    const notices = (
        <Notices
            store={resource}
            what={_('setting')}
            diagnosticsTitle={_('Not saved: the code has errors')}
        />
    );

    if (!base || !draft) {
        return (
            <FormCenter>
                {!editor.loaded && <LoadingState />}
                {notices}
            </FormCenter>
        );
    }

    const info = ENGINE_SECTION_INFO[base.section];

    const onDelete = async () => {
        const ok = await modals.confirm({
            title: _('Delete %s?', info.title()),
            message: _(
                'This deletes %s and its description. %s',
                base.file,
                info.whenMissing()
            ),
            danger: true,
        });
        if (ok) await editor.remove();
    };

    return (
        <FormPage>
            <EditorHeader
                title={info.title()}
                store={resource}
                onDelete={base.exists ? () => void onDelete() : undefined}
            />
            <FormMeta>
                <span data-meta="file">
                    <code>{base.file}</code>
                </span>
                <span data-meta="state">{stateText(base)}</span>
            </FormMeta>
            {notices}
            <FormFields>
                <FormTextInput
                    label={_('Description')}
                    value={draft.description}
                    onChange={(next) => editor.setDescription(next ?? '')}
                    placeholder={info.placeholder()}
                    helperText={_(
                        'What this setting should do, in plain words. It is saved as the JSDoc of the code, so it can be saved without any code.'
                    )}
                    disabled={resource.saving}
                    multiline
                    minRows={5}
                    dataField="description"
                />
                <FormSection title={_('Implementation')}>
                    {editor.codeOpen ? (
                        <>
                            <CodeEditor
                                value={draft.code}
                                onChange={editor.setCode}
                                diagnostics={editor.codeDiagnostics}
                                jsx={info.jsx}
                                readOnly={resource.saving}
                                minHeight="240px"
                                ariaLabel={_('Code of %s', info.title())}
                            />
                            <SHints>
                                {editor.hasTypeErrors && (
                                    <HintText>
                                        {_(
                                            'Type error positions refer to the saved file, which also holds the description.'
                                        )}
                                    </HintText>
                                )}
                                <HintText>{info.arguments()}</HintText>
                                <HintText>{info.imports()}</HintText>
                                <HintText>
                                    {_(
                                        'Empty code saves the stub, which keeps the default.'
                                    )}
                                </HintText>
                            </SHints>
                        </>
                    ) : (
                        <SCollapsed>
                            <HintText>
                                {_('Not implemented yet.')} {info.whenMissing()}
                            </HintText>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Code />}
                                onClick={editor.implementManually}
                                disabled={resource.saving}
                                data-action="implement"
                            >
                                {_('Implement manually')}
                            </Button>
                        </SCollapsed>
                    )}
                </FormSection>
            </FormFields>
        </FormPage>
    );
});

const SHints = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1)};
`;

const SCollapsed = styled('div')`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: ${spacingCss(1)};
`;
