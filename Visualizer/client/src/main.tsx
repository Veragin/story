import { createRoot } from 'react-dom/client';
import { Wrapper } from './Wrapper';
import { Shell } from './shell/Shell';
import { ThemeProvider } from '@mui/material';
import { GlobalThemeWrapper } from '@story/ui';
import { darkTheme } from './theme';
import '@story/ui/index.css';
import { goToLanding, STORY_ID } from './api';

const rootElement = document.getElementById('root');

if (!STORY_ID) {
    goToLanding();
} else if (rootElement) {
    createRoot(rootElement).render(
        <GlobalThemeWrapper>
            <ThemeProvider theme={darkTheme}>
                <Wrapper>
                    <Shell />
                </Wrapper>
            </ThemeProvider>
        </GlobalThemeWrapper>
    );
}
