import { createRoot } from 'react-dom/client';
import { Engine } from 'code/Engine/Engine';
import { Wrapper } from 'code/Engine/Wrapper';
import { GlobalWrapper } from 'code/GlobalWrapper';

createRoot(document.getElementById('root')!).render(
    <GlobalWrapper>
        <Wrapper>
            <Engine />
        </Wrapper>
    </GlobalWrapper>
);
