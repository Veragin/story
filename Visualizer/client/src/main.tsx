import { createRoot } from 'react-dom/client';
import { Wrapper } from './Wrapper';
import { Shell } from './shell/Shell';
import { ThemeProvider } from '@mui/material';
import { GlobalThemeWrapper } from '@story/ui';
import { darkTheme } from './theme';
import '@story/ui/index.css';
import { goToLanding, STORY_ID } from './api';

// The Visualizer edits the story in `?story=<id>` (`api/story.ts`); the landing page picks it.
if (!STORY_ID) {
    goToLanding();
} else {
    createRoot(document.getElementById('root')!).render(
        <GlobalThemeWrapper>
            <ThemeProvider theme={darkTheme}>
                <Wrapper>
                    <Shell />
                </Wrapper>
            </ThemeProvider>
        </GlobalThemeWrapper>
    );
}
