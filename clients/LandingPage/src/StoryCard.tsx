import { type ElementType, useState } from 'react';
import {
    Button,
    Card,
    CardActions,
    CardContent,
    Collapse,
    IconButton,
    Stack,
    styled,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    ExpandLess,
    ExpandMore,
    Lock,
    LockOpen,
    OpenInNew,
    PlayArrow,
    Public,
} from '@mui/icons-material';
import { spacingCss } from '@story/ui';
import type { TStoryListItemDto } from '@story/protocol';
import { StoryActionsMenu } from './StoryActionsMenu';

type TProps = {
    story: TStoryListItemDto;
    onOpen: () => void;
    onPlay: () => void;
    onExport: () => void;
    onExportWeb: () => void;
    onImport: (zip: File) => void;
};

export const StoryCard = ({
    story,
    onOpen,
    onPlay,
    onExport,
    onExportWeb,
    onImport,
}: TProps) => {
    const [expanded, setExpanded] = useState(false);
    const hasDescription = story.description.trim() !== '';

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Tooltip
                        title={story.unlocked ? _('Unlocked') : _('Locked')}
                    >
                        {story.unlocked ? (
                            <LockOpen fontSize="small" color="success" />
                        ) : (
                            <Lock fontSize="small" color="disabled" />
                        )}
                    </Tooltip>
                    <STitle variant="h6" component="h2">
                        {story.name}
                    </STitle>
                    {story.public && (
                        <Tooltip title={_('Public: anyone may play it')}>
                            <Public fontSize="small" color="action" />
                        </Tooltip>
                    )}
                    <Tooltip
                        title={
                            hasDescription
                                ? expanded
                                    ? _('Hide description')
                                    : _('Show description')
                                : _('No description')
                        }
                    >
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => setExpanded(!expanded)}
                                disabled={!hasDescription}
                                aria-expanded={expanded}
                            >
                                {expanded ? <ExpandLess /> : <ExpandMore />}
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                    {story.author || _('unknown author')}
                </Typography>
                <Collapse in={expanded} unmountOnExit>
                    <SDescription variant="body2">
                        {story.description}
                    </SDescription>
                </Collapse>
            </CardContent>
            <SActions>
                <Button size="small" startIcon={<OpenInNew />} onClick={onOpen}>
                    {_('Open')}
                </Button>
                <Button size="small" startIcon={<PlayArrow />} onClick={onPlay}>
                    {_('Play as single')}
                </Button>
                <SSpacer />
                <StoryActionsMenu
                    onExport={onExport}
                    onExportWeb={onExportWeb}
                    onImport={onImport}
                />
            </SActions>
        </Card>
    );
};

const STitle = styled(Typography)<{ component: ElementType }>`
    flex: 1;
`;

const SDescription = styled(Typography)`
    margin-top: ${spacingCss(1)};
    white-space: pre-wrap;
`;

const SActions = styled(CardActions)`
    flex-wrap: wrap;
    gap: ${spacingCss(1)};
`;

const SSpacer = styled('div')`
    flex: 1;
`;
