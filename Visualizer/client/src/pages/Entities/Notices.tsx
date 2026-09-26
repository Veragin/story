import { Alert, AlertTitle, Button, styled } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { spacingCss } from '@story/ui';
import type { EntitiesStore } from './EntitiesStore';

/** Stale / diagnostics / references / error banners above the entity form. */
export const Notices = observer(({ store }: { store: EntitiesStore }) => {
    const { stale, diagnostics, references, error } = store;
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
                                {stale.current === null
                                    ? _('Discard mine')
                                    : _('Reload')}
                            </Button>
                            <Button
                                color="inherit"
                                size="small"
                                variant="outlined"
                                onClick={() => void store.keepMine()}
                                disabled={store.saving}
                            >
                                {stale.current === null
                                    ? _('Re-create')
                                    : _('Keep mine')}
                            </Button>
                        </>
                    }
                >
                    <AlertTitle>
                        {stale.current === null
                            ? _('Deleted on disk')
                            : _('Changed on disk')}
                    </AlertTitle>
                    {stale.current === null
                        ? _(
                              'This entity was deleted outside this form. Your input is still here.'
                          )
                        : _(
                              'The file changed since you started editing. Reload it, or keep your changes and save them on top.'
                          )}
                </Alert>
            )}
            {diagnostics.length > 0 && (
                <Alert severity="error">
                    <AlertTitle>
                        {_('Not saved: the change does not type-check')}
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
                        {_('Not deleted: still referenced')}
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
            {error && (
                <Alert severity="error" onClose={store.dismissError}>
                    {error}
                </Alert>
            )}
        </SNotices>
    );
});

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
