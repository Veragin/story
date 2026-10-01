import { createRoot } from 'react-dom/client';
import { GlobalThemeWrapper } from '@story/ui';
import { MultiEngine } from './MultiEngine';
import '@story/ui/index.css';

const container = document.getElementById('root');
if (container === null) throw new Error('Missing #root element');

createRoot(container).render(
    <GlobalThemeWrapper>
        <MultiEngine />
    </GlobalThemeWrapper>
);
