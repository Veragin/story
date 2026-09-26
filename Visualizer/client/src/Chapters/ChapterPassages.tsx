import { Button, styled, ThemeProvider, Typography } from '@mui/material';
import { spacingCss } from '@story/ui';
import type { TChapterId } from '@story/types';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useVisualizerStore } from '../context';
import { ResizableSplitter } from '../Passages/ResizableSplitter';
import { ChapterPassagesGraph } from '../Passages/ChapterPassagesGraph';
import { ScreenPassageCreationForm } from '../Passages/ScreenPassageCreationForm/ScreenPassageCreationForm';
import { darkTheme } from '../theme';
import { ControlBar, PageContainer, router } from '../shell';

type Props = {
    chapterId: TChapterId;
};

export const ChapterPassages = ({ chapterId }: Props) => {
    const store = useVisualizerStore();

    const handlePassageCreated = (passageId: string) => {
        // Handle passage creation - you might want to refresh the graph or perform other actions
        console.log('Passage created:', passageId);
        // You could trigger a refresh of the ChapterPassagesGraph here if needed
    };

    return (
        <PageContainer>
            <ControlBar>
                <Typography variant="body2" sx={{ mr: 1 }}>
                    {_('Chapter: %s', chapterId)}
                </Typography>
                <Button
                    color="inherit"
                    size="small"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => router.navigate({ page: 'timeline' })}
                >
                    {_('Timeline')}
                </Button>
            </ControlBar>

            <SContentArea>
                <ResizableSplitter
                    leftContent={<ChapterPassagesGraph chapterId={chapterId} />}
                    rightContent={
                        <SFormContainer>
                            <ThemeProvider theme={darkTheme}>
                                <ScreenPassageCreationForm
                                    chapterId={chapterId}
                                    agent={store.agent}
                                    onPassageCreated={handlePassageCreated}
                                />
                            </ThemeProvider>
                        </SFormContainer>
                    }
                    initialLeftWidth={75}
                    minLeftWidth={30}
                    maxLeftWidth={85}
                />
            </SContentArea>
        </PageContainer>
    );
};

const SContentArea = styled('div')`
    flex: 1;
    min-height: 0;
    overflow: hidden;
    border-bottom: 1px solid grey;
`;

const SFormContainer = styled('div')`
    height: 100%;
    overflow-y: auto;
    padding: ${spacingCss(1.5)};
    background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);

    /* Custom scrollbar for dark theme */
    &::-webkit-scrollbar {
        width: 8px;
    }

    &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px;

        &:hover {
            background: rgba(255, 255, 255, 0.5);
        }
    }

    /* Ensure form fits well */
    & > * {
        max-width: 100%;
    }
`;
