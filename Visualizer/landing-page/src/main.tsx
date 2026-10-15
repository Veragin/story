import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material';
import { GlobalThemeWrapper } from '@story/ui';
import { App } from './App';
import { darkTheme } from './theme';
import '@story/ui/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
    <GlobalThemeWrapper>
        <ThemeProvider theme={darkTheme}>
            <App />
        </ThemeProvider>
    </GlobalThemeWrapper>
);
