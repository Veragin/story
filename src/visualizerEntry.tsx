import { createRoot } from 'react-dom/client';
import { Visualizer } from 'code/Visualizer/Visualizer';
import { Wrapper } from 'code/Engine/Wrapper';
import { GlobalWrapper } from 'code/GlobalWrapper';

createRoot(document.getElementById('root')!).render(
    <GlobalWrapper>
        <Wrapper>
            <Visualizer />
        </Wrapper>
    </GlobalWrapper>
);
