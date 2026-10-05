import { Alert, AlertTitle, Button, styled } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { spacingCss } from '@story/ui';
import type {
    TClearedReferenceDto,
    TDiagnosticDto,
    TReferenceDto,
} from '@story/visualizer-protocol';
import { clearedText } from './clearedReferences';

export interface INoticesSource {
    readonly stale: { current: unknown } | null;
    readonly diagnostics: readonly TDiagnosticDto[];
    readonly references: readonly TReferenceDto[] | null;
    readonly cleared: readonly TClearedReferenceDto[] | null;
    readonly info: string | null;
    readonly error: string | null;
    readonly saving: boolean;
    reload(): void;
    keepMine(): Promise<boolean>;
    dismissReferences(): void;
    dismissCleared(): void;
    dismissInfo(): void;
    dismissError(): void;
}

type TProps = {
    store: INoticesSource;
    what?: string;
    diagnosticsTitle?: string;
};

export const Notices = observer(
    ({ store, what = _('entry'), diagnosticsTitle }: TProps) => {
        const { stale, diagnostics, references, cleared, info, error } = store;
        const deleted = stale?.current === null;
        return (
            <SNotices>
                {stale && (
                    <Alert
                        severity="warning"
                        action={
                            <>
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={store.reload}
                                    disabled={store.saving}
                                >
                                    {deleted ? _('Discard mine') : _('Reload')}
                                </Button>
                                <Button
                                    color="inherit"
                                    size="small"
                                    variant="outlined"
                                    onClick={() => void store.keepMine()}
                                    disabled={store.saving}
                                >
                                    {deleted ? _('Re-create') : _('Keep mine')}
                                </Button>
                            </>
                        }
                    >
                        <AlertTitle>
                            {deleted
                                ? _('Deleted on disk')
                                : _('Changed on disk')}
                        </AlertTitle>
                        {deleted
                            ? _(
                                  'This %s was deleted outside this form. Your input is still here.',
                                  what
                              )
                            : _(
                                  'The file changed since you started editing. Reload it, or keep your changes and save them on top.'
                              )}
                    </Alert>
                )}
                {diagnostics.length > 0 && (
                    <Alert severity="error">
                        <AlertTitle>
                            {diagnosticsTitle ??
                                _('Not saved: the change does not type-check')}
                        </AlertTitle>
                        <SList>
                            {diagnostics.map((d, i) => (
                                <li key={i}>
                                    <code>
                                        {d.file}:{d.line}:{d.column}
                                    </code>
                                    {d.field && <SField> [{d.field}]</SField>}{' '}
                                    {d.message}
                                </li>
                            ))}
                        </SList>
                    </Alert>
                )}
                {references && (
                    <Alert severity="error" onClose={store.dismissReferences}>
                        <AlertTitle>
                            {_('Refused: still referenced')}
                        </AlertTitle>
                        {references.length === 0 ? (
                            _('The server did not say where.')
                        ) : (
                            <SList>
                                {references.map((r, i) => (
                                    <li key={i}>
                                        <code>
                                            {r.file}:{r.line}
                                        </code>
                                        {r.passageId && (
                                            <SField> {r.passageId}</SField>
                                        )}
                                        {r.text && <SText> {r.text}</SText>}
                                    </li>
                                ))}
                            </SList>
                        )}
                    </Alert>
                )}
                {cleared && (
                    <Alert
                        severity="info"
                        onClose={store.dismissCleared}
                        data-notice="cleared"
                    >
                        <AlertTitle>
                            {_('Deleted. Values cleared: %d', cleared.length)}
                        </AlertTitle>
                        <SList>
                            {cleared.map((ref, i) => (
                                <li key={i}>{clearedText(ref)}</li>
                            ))}
                        </SList>
                    </Alert>
                )}
                {info && (
                    <Alert
                        severity="success"
                        onClose={store.dismissInfo}
                        data-notice="info"
                    >
                        {info}
                    </Alert>
                )}
                {error && (
                    <Alert severity="error" onClose={store.dismissError}>
                        {error}
                    </Alert>
                )}
            </SNotices>
        );
    }
);

const SNotices = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1)};
    &:empty {
        display: none;
    }
`;

const SList = styled('ul')`
    margin: 0;
    padding-left: ${spacingCss(2)};
    & code {
        font-size: 12px;
    }
`;

const SField = styled('span')`
    opacity: 0.8;
`;

const SText = styled('span')`
    font-family: monospace;
    opacity: 0.7;
`;
