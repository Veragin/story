import { createRoot } from 'react-dom/client';
import { Visualizer } from './Visualizer';
import { Wrapper } from './Wrapper';
import { GlobalThemeWrapper } from '@story/ui';
import '@story/ui/index.css';

createRoot(document.getElementById('root')!).render(
    <GlobalThemeWrapper>
        <Wrapper>
            <Visualizer />
        </Wrapper>
    </GlobalThemeWrapper>
);
