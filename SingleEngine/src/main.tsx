import { createRoot } from 'react-dom/client';
import { Engine } from './Engine';
import { Wrapper } from './Wrapper';
import { GlobalThemeWrapper } from '@story/ui';
import '@story/ui/index.css';

createRoot(document.getElementById('root')!).render(
    <GlobalThemeWrapper>
        <Wrapper>
            <Engine />
        </Wrapper>
    </GlobalThemeWrapper>
);
