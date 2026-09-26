import { createRoot } from 'react-dom/client';
import { Wrapper } from './Wrapper';
import { Shell } from './shell/Shell';
import { GlobalThemeWrapper } from '@story/ui';
import '@story/ui/index.css';

createRoot(document.getElementById('root')!).render(
    <GlobalThemeWrapper>
        <Wrapper>
            <Shell />
        </Wrapper>
    </GlobalThemeWrapper>
);
