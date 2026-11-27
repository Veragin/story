import { Alert, AlertTitle, styled } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { spacingCss } from '@story/ui';
import type {
    TClearedReferenceDto,
    TDiagnosticDto,
    TReferenceDto,
} from '@story/protocol';
import { clearedText } from '../clearedReferences';
import { BulletList } from './BulletList';
import { ConflictAlert } from './ConflictAlert';
import { DiagnosticsList } from './DiagnosticsList';
import { ErrorAlert } from './ErrorAlert';
import { ReferenceList } from './ReferenceList';

interface INoticesSource {
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
        return (
            <SNotices>
                {stale && (
                    <ConflictAlert
                        deleted={stale.current === null}
                        what={what}
                        onReload={() => store.reload()}
                        onKeepMine={() => store.keepMine()}
                        disabled={store.saving}
                    />
                )}
                <DiagnosticsList
                    diagnostics={diagnostics}
                    title={
                        diagnosticsTitle ??
                        _('Not saved: the change does not type-check')
                    }
                />
                {references && (
                    <Alert severity="error" onClose={store.dismissReferences}>
                        <AlertTitle>
                            {_('Refused: still referenced')}
                        </AlertTitle>
                        {references.length === 0 ? (
                            _('The server did not say where.')
                        ) : (
                            <ReferenceList references={references} />
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
                        <BulletList>
                            {cleared.map((ref, i) => (
                                <li key={i}>{clearedText(ref)}</li>
                            ))}
                        </BulletList>
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
                <ErrorAlert error={error} onClose={store.dismissError} />
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
