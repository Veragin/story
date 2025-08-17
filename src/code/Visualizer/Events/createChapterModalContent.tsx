import { Button, styled, Tooltip } from '@mui/material';
import { Column, Row } from 'code/components/Basic';
import { useVisualizerStore } from 'code/Context';
import { ReactNode, useState } from 'react';
import { TChapter } from 'types/TChapter';
import { TChapterId } from 'types/TIds';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import { SmallText, Text } from 'code/components/Text';
import { spacingCss } from 'code/components/css';
import { Modal } from 'code/components/Modal';

export const createChapterModalContent = (chapter: TChapter<TChapterId>): ReactNode => (
    <ChapterModalContent chapter={chapter} />
);

const ChapterModalContent = ({ chapter }: { chapter: TChapter<TChapterId> }) => {
    const [open, setOpen] = useState(false);
    const store = useVisualizerStore();

    const start = store.timeManager.renderTime(
        chapter.timeRange.start,
        'dateTime'
    );
    const end = store.timeManager.renderTime(chapter.timeRange.end, 'dateTime');

    return (
        <SColumn>
            <Tooltip title={_('Copy to clipboard')} placement="top">
                <SText
                    onClick={() => navigator.clipboard.writeText(chapter.chapterId)}
                >
                    {chapter.chapterId}
                </SText>
            </Tooltip>
            <SmallText>{`${start} - ${end}`}</SmallText>
            <SRow>
                <Tooltip title={_('Open in VS code')}>
                    <Button
                        variant="outlined"
                        color="inherit"
                        onClick={() => store.agent.openChapter(chapter.chapterId)}
                    >
                        <OpenInBrowserIcon />
                    </Button>
                </Tooltip>
                <Tooltip title={_('Set time of the chapter')}>
                    <Button
                        variant="outlined"
                        color="inherit"
                        onClick={() => store.agent.openChapter(chapter.chapterId)}
                    >
                        <AccessTimeFilledIcon />
                    </Button>
                </Tooltip>
                <Tooltip title={_('Delete chapter')}>
                    <Button
                        color="error"
                        variant="outlined"
                        onClick={() => setOpen(true)}
                    >
                        <DeleteIcon />
                    </Button>
                </Tooltip>
            </SRow>
            <Modal
                title={_('Delete chapter %s', chapter.chapterId)}
                open={open}
                onClose={() => setOpen(false)}
            >
                <SColumn>
                    <Text>
                        {_(
                            'Are you sure that you want to delete %s chapter?',
                            chapter.chapterId
                        )}
                    </Text>
                    <SRow>
                        <Button color="error" variant="contained">
                            {_('Delete')}
                        </Button>
                        <Button
                            onClick={() => setOpen(false)}
                            variant="outlined"
                            color="inherit"
                        >
                            {_('Cancel')}
                        </Button>
                    </SRow>
                </SColumn>
            </Modal>
        </SColumn>
    );
};

const SText = styled(Text)`
    cursor: pointer;
    &:hover {
        color: yellow;
    }
`;

const SRow = styled(Row)`
    gap: ${spacingCss(1)};
    justify-content: end;
    min-width: 260px;
`;

const SColumn = styled(Column)`
    gap: ${spacingCss(2)};
`;
