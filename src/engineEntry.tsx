import { createRoot } from 'react-dom/client';
import { Engine } from 'code/Engine/Engine';
import { Wrapper } from 'code/Engine/Wrapper';
import { GlobalThemeWrapper } from 'code/theme/GlobalThemeWrapper';

createRoot(document.getElementById('root')!).render(
    <GlobalThemeWrapper>
        <Wrapper>
            <Engine />
        </Wrapper>
    </GlobalThemeWrapper>
);
