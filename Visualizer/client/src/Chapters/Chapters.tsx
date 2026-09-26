import { styled, ThemeProvider } from '@mui/material';
import { spacingCss } from '@story/ui';
import type { TChapterId } from '@story/types';
import { useVisualizerStore } from '../context';
import { ResizableSplitter } from '../Passages/ResizableSplitter';
import { ChapterTimeline } from './ChapterTimeline';
import { ChapterCreationForm } from './ChapterCreationForm/ChapterCreationForm';
import { darkTheme } from '../theme';
import { PageContainer, router } from '../shell';

export const Chapters = () => {
    const store = useVisualizerStore();

    const handleChapterCreated = (chapterId: string) => {
        // open the new chapter's passages
        router.navigate({
            page: 'chapter',
            chapterId: chapterId as TChapterId,
        });
    };

    return (
        <PageContainer>
            <SContentArea>
                <ResizableSplitter
                    leftContent={
                        <STimelineContainer>
                            <ChapterTimeline />
                        </STimelineContainer>
                    }
                    rightContent={
                        <SFormContainer>
                            <ThemeProvider theme={darkTheme}>
                                <ChapterCreationForm
                                    agent={store.agent}
                                    onChapterCreated={handleChapterCreated}
                                />
                            </ThemeProvider>
                        </SFormContainer>
                    }
                    initialLeftWidth={65}
                    minLeftWidth={30}
                    maxLeftWidth={80}
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

const STimelineContainer = styled('div')`
    height: 100%;
    width: 100%;
    overflow: hidden;
    background-color: ${({ theme }) =>
        theme?.palette?.background?.default || '#fafafa'};

    /* Ensure timeline fits well */
    & > * {
        height: 100%;
        width: 100%;
    }
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
