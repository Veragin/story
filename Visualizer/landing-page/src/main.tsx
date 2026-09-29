import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material';
import { GlobalThemeWrapper } from '@story/ui';
import { App } from './App';
import { darkTheme } from './theme';
import '@story/ui/index.css';

createRoot(document.getElementById('root')!).render(
    <GlobalThemeWrapper>
        <ThemeProvider theme={darkTheme}>
            <App />
        </ThemeProvider>
    </GlobalThemeWrapper>
);
