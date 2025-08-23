import { createRoot } from 'react-dom/client';
import { Visualizer } from 'code/Visualizer/Visualizer';
import { Wrapper } from 'code/Visualizer/Wrapper';
import { GlobalThemeWrapper } from 'code/theme/GlobalThemeWrapper';

createRoot(document.getElementById('root')!).render(
    <GlobalThemeWrapper>
        <Wrapper>
            <Visualizer />
        </Wrapper>
    </GlobalThemeWrapper>
);
