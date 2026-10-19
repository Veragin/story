import { useEffect, useState } from 'react';
import { Button, styled, Tooltip } from '@mui/material';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import { observer } from 'mobx-react-lite';
import { spacingCss } from '@story/ui';
import { gitStore } from '../context';
import { GitMenu } from '../git/GitMenu';
import { openGitSettingsDialog } from '../git/gitDialogs';

export const GitButton = observer(() => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);

    useEffect(() => gitStore.start(), []);

    if (!gitStore.available) return null;

    const status = gitStore.status;
    if (!status) {
        return (
            <SButton
                variant="outlined"
                color="inherit"
                size="small"
                startIcon={<CallSplitIcon />}
                onClick={openGitSettingsDialog}
            >
                {_('Git')}
            </SButton>
        );
    }

    const changes = gitStore.changeCount;
    const summary = [
        _('Branch %s', status.branch),
        changes > 0
            ? _('%d uncommitted changes', changes)
            : _('No uncommitted changes'),
        status.ahead > 0 ? _('%d commits to push', status.ahead) : null,
        status.behind > 0 ? _('%d commits to pull', status.behind) : null,
    ].filter((line) => line !== null);

    return (
        <>
            <Tooltip title={summary.join(' · ')}>
                <SButton
                    color="inherit"
                    size="small"
                    startIcon={<CallSplitIcon />}
                    aria-label={_('Git')}
                    onClick={(e) => {
                        setAnchor(e.currentTarget);
                        void gitStore.fetch();
                    }}
                >
                    <SBranch>{status.branch}</SBranch>
                    {changes > 0 && <SDirty>● {changes}</SDirty>}
                    {status.ahead > 0 && <span>↑{status.ahead}</span>}
                    {status.behind > 0 && <span>↓{status.behind}</span>}
                </SButton>
            </Tooltip>
            {anchor && (
                <GitMenu
                    store={gitStore}
                    anchorEl={anchor}
                    onClose={() => setAnchor(null)}
                />
            )}
        </>
    );
});

const SButton = styled(Button)`
    flex-shrink: 0;
    gap: ${spacingCss(0.75)};
    text-transform: none;
`;

const SBranch = styled('span')`
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const SDirty = styled('span')`
    color: ${({ theme }) => theme.palette.warning.light};
`;
