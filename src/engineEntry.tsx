import { createRoot } from 'react-dom/client';
import { Engine } from 'code/Engine/Engine';
import { Wrapper } from 'code/Wrapper';

createRoot(document.getElementById('root')!).render(
    <Wrapper>
        <Engine />
    </Wrapper>
);
