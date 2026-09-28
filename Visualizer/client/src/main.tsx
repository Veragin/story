import { createRoot } from 'react-dom/client';
import { Wrapper } from './Wrapper';
import { Shell } from './shell/Shell';
import { ThemeProvider } from '@mui/material';
import { GlobalThemeWrapper } from '@story/ui';
import { darkTheme } from './theme';
import '@story/ui/index.css';

createRoot(document.getElementById('root')!).render(
    <GlobalThemeWrapper>
        <ThemeProvider theme={darkTheme}>
            <Wrapper>
                <Shell />
            </Wrapper>
        </ThemeProvider>
    </GlobalThemeWrapper>
);
