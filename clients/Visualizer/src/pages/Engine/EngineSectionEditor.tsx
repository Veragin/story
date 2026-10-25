import {
    Button,
    CircularProgress,
    styled,
    TextField,
    Typography,
} from '@mui/material';
import Code from '@mui/icons-material/Code';
import { observer } from 'mobx-react-lite';
import type { TEngineSectionDto } from '@story/protocol';
import { spacingCss } from '@story/ui';
import { CodeEditor } from '../../components/CodeEditor/CodeEditor';
import { FormHeader } from '../../components/FormHeader';
import {
    FormCenter,
    FormFields,
    FormMeta,
    FormPage,
} from '../../components/formLayout';
import { Notices } from '../../components/Notices';
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
                {!editor.loaded && <CircularProgress size={24} />}
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
            <FormHeader
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
                <TextField
                    label={_('Description')}
                    value={draft.description}
                    onChange={(e) => editor.setDescription(e.target.value)}
                    placeholder={info.placeholder()}
                    helperText={_(
                        'What this setting should do, in plain words. It is saved as the JSDoc of the code, so it can be saved without any code.'
                    )}
                    disabled={resource.saving}
                    multiline
                    minRows={5}
                    fullWidth
                    inputProps={{ 'data-field': 'description' }}
                />
                <SSection data-section="implementation">
                    <Typography variant="subtitle2">
                        {_('Implementation')}
                    </Typography>
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
                            {editor.hasTypeErrors && (
                                <SHelp>
                                    {_(
                                        'Type error positions refer to the saved file, which also holds the description.'
                                    )}
                                </SHelp>
                            )}
                            <SHelp>{info.arguments()}</SHelp>
                            <SHelp>{info.imports()}</SHelp>
                            <SHelp>
                                {_(
                                    'Empty code saves the stub, which keeps the default.'
                                )}
                            </SHelp>
                        </>
                    ) : (
                        <SCollapsed>
                            <SHelp>
                                {_('Not implemented yet.')} {info.whenMissing()}
                            </SHelp>
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
                </SSection>
            </FormFields>
        </FormPage>
    );
});

const SSection = styled('div')`
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

const SHelp = styled('div')`
    font-size: 12px;
    color: ${({ theme }) => theme.palette.text.secondary};
`;
