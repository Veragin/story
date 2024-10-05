import { createRoot } from 'react-dom/client';
import { Visualizer } from 'code/Visualizer/Visualizer';
import { Wrapper } from 'code/Wrapper';

createRoot(document.getElementById('root')!).render(
    <Wrapper>
        <Visualizer />
    </Wrapper>
);
