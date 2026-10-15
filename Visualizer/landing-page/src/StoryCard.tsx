import { useState } from 'react';
import {
    Button,
    Card,
    CardActions,
    CardContent,
    Collapse,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Download,
    Edit,
    ExpandLess,
    ExpandMore,
    Lock,
    LockOpen,
    OpenInNew,
    PlayArrow,
    Public,
} from '@mui/icons-material';
import type { TStoryListItemDto } from '@story/visualizer-protocol';

type TProps = {
    story: TStoryListItemDto;
    onEdit: () => void;
    onOpen: () => void;
    onPlay: () => void;
    onExport: () => void;
};

export const StoryCard = ({
    story,
    onEdit,
    onOpen,
    onPlay,
    onExport,
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
                    <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
                        {story.name}
                    </Typography>
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
                    <Typography
                        variant="body2"
                        sx={{ mt: 1, whiteSpace: 'pre-wrap' }}
                    >
                        {story.description}
                    </Typography>
                </Collapse>
            </CardContent>
            <CardActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button size="small" startIcon={<Edit />} onClick={onEdit}>
                    {_('Edit')}
                </Button>
                <Button size="small" startIcon={<OpenInNew />} onClick={onOpen}>
                    {_('Open')}
                </Button>
                <Button size="small" startIcon={<PlayArrow />} onClick={onPlay}>
                    {_('Play as single')}
                </Button>
                <Button
                    size="small"
                    startIcon={<Download />}
                    onClick={onExport}
                >
                    {_('Export')}
                </Button>
            </CardActions>
        </Card>
    );
};
