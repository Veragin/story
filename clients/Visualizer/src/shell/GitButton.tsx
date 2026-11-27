import { useEffect, useState } from 'react';
import { Badge, IconButton, styled, Tooltip } from '@mui/material';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import { observer } from 'mobx-react-lite';
import { gitStore } from '../context';
import { GitMenu } from '../git/GitMenu';
import { openGitSettings } from '../git/gitDialogs';

export const GitButton = observer(() => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);

    useEffect(() => gitStore.start(), []);

    if (!gitStore.available) return null;

    const status = gitStore.status;
    if (!status) {
        return (
            <Tooltip title={_('Set up git')}>
                <SButton
                    color="inherit"
                    size="small"
                    aria-label={_('Git')}
                    onClick={openGitSettings}
                >
                    <CallSplitIcon />
                </SButton>
            </Tooltip>
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
                    aria-label={_('Git')}
                    onClick={(e) => {
                        setAnchor(e.currentTarget);
                        void gitStore.fetch();
                    }}
                >
                    <Badge badgeContent={changes} color="warning" max={999}>
                        <CallSplitIcon />
                    </Badge>
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

const SButton = styled(IconButton)`
    flex-shrink: 0;
`;
