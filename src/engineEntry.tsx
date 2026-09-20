import { createRoot } from 'react-dom/client';
import { Engine } from 'code/Engine/Engine';
import { Wrapper } from 'code/Engine/Wrapper';
import { GlobalThemeWrapper } from '@story/ui';
import '@story/ui/index.css';

createRoot(document.getElementById('root')!).render(
    <GlobalThemeWrapper>
        <Wrapper>
            <Engine />
        </Wrapper>
    </GlobalThemeWrapper>
);
