import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { styled } from '@mui/material';
import type { TSourceOwner } from '@story/protocol';
import { spacingCss } from '@story/ui';
import { apiEvents, type ApiEvents, type TVisualizerApi } from '../../api';
import { modals } from '../../shell/modals';
import { AppDialog } from '../dialog/AppDialog';
import { DialogButtons } from '../dialog/DialogButtons';
import { ConflictAlert } from '../feedback/ConflictAlert';
import { DiagnosticsList } from '../feedback/DiagnosticsList';
import { ErrorAlert } from '../feedback/ErrorAlert';
import { HintText } from '../feedback/HintText';
import { LoadingState } from '../feedback/LoadingState';
import { CodeEditor } from './CodeEditor';
import { SourceEditorStore } from './SourceEditorStore';

type TProps = {
    owner: TSourceOwner;
    id: string;
    api: TVisualizerApi;
    events?: ApiEvents;
    onClose: () => void;
};

export const SourceEditorDialog = observer(
    ({ owner, id, api, events = apiEvents, onClose }: TProps) => {
        const [store] = useState(
            () => new SourceEditorStore(owner, id, api, events)
        );
        useEffect(() => {
            void store.start();
            return () => store.destroy();
        }, [store]);

        const close = async () => {
            if (
                store.dirty &&
                !(await modals.confirm({
                    title: _('Discard your changes?'),
                    message: _('The file has unsaved changes.'),
                    danger: true,
                    confirmLabel: _('Discard'),
                }))
            ) {
                return;
            }
            onClose();
        };

        const { conflict } = store;
        const fileErrors = store.fileDiagnostics.length;

        return (
            <AppDialog
                size="lg"
                onClose={() => void close()}
                onKeyDown={(e) => {
                    if (
                        (e.ctrlKey || e.metaKey) &&
                        e.key.toLowerCase() === 's'
                    ) {
                        e.preventDefault();
                        void store.save();
                    }
                }}
                title={
                    <>
                        {owner === 'chapter'
                            ? _('Chapter %s', id)
                            : _('Passage %s', id)}
                        <SFile>{store.base?.file ?? ' '}</SFile>
                    </>
                }
                actions={
                    <>
                        <SActionsHint>
                            {_(
                                'Saving formats the file and type-checks the story first.'
                            )}
                        </SActionsHint>
                        <DialogButtons
                            onClose={() => void close()}
                            onConfirm={() => void store.save()}
                            cancelLabel={
                                store.dirty ? _('Discard') : _('Close')
                            }
                            label={_('Save')}
                            busyLabel={_('Saving…')}
                            busy={store.saving}
                            disabled={!store.dirty || store.conflict !== null}
                        />
                    </>
                }
            >
                <SBody>
                    {conflict && (
                        <ConflictAlert
                            deleted={!conflict.current}
                            what={_('file')}
                            onReload={
                                conflict.current
                                    ? () => store.reloadFromDisk()
                                    : undefined
                            }
                            onKeepMine={
                                conflict.current
                                    ? () => store.keepMine()
                                    : undefined
                            }
                        />
                    )}
                    <ErrorAlert error={store.error ?? store.loadError} />
                    <ErrorAlert
                        error={
                            fileErrors === 0
                                ? null
                                : fileErrors === 1
                                  ? _(
                                        'Not saved: 1 type error, marked beside its line.'
                                    )
                                  : _(
                                        'Not saved: %d type errors, marked beside their lines.',
                                        fileErrors
                                    )
                        }
                    />
                    <DiagnosticsList
                        diagnostics={store.otherDiagnostics}
                        title={_('Not saved: the change breaks other files.')}
                    />
                    {store.base ? (
                        <SEditor>
                            <CodeEditor
                                value={store.text}
                                onChange={(text) => store.setText(text)}
                                diagnostics={store.fileDiagnostics}
                                height="100%"
                                autoFocus
                                readOnly={store.saving}
                            />
                        </SEditor>
                    ) : (
                        !store.loadError && <LoadingState />
                    )}
                </SBody>
            </AppDialog>
        );
    }
);

const SBody = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1)};
    height: 70vh;
`;

const SEditor = styled('div')`
    flex: 1;
    min-height: 0;
`;

const SFile = styled('span')`
    display: block;
    font-size: ${({ theme }) => theme.typography.meta.fontSize};
    font-weight: normal;
    color: ${({ theme }) => theme.palette.text.secondary};
`;

const SActionsHint = styled(HintText)`
    margin-right: auto;
    padding-left: ${spacingCss(2)};
`;
