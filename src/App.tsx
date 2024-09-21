import { Button, styled } from '@mui/material';
import { Column, WholeContainer } from 'code/Components/Basic';
import { spacingCss } from 'code/Components/css';
import { Title } from 'code/Components/Text';
import { Engine } from 'code/Engine/Engine';
import { Visualizer } from 'code/Visualizer/Visualizer';
import { useState } from 'react';

export const App = () => {
    const [service, setService] = useState<null | 'engine' | 'visualizer'>(null);

    if (service === 'engine') {
        return <Engine />;
    }

    if (service === 'visualizer') {
        return <Visualizer />;
    }

    return (
        <WholeContainer>
            <SContainer>
                <STitle>Choose a service</STitle>
                <Button onClick={() => setService('engine')} variant="contained">
                    Start
                </Button>
                <Button onClick={() => setService('visualizer')} variant="contained">
                    Visualiser
                </Button>
            </SContainer>
        </WholeContainer>
    );
};

const SContainer = styled(Column)`
    justify-content: center;
    gap: ${spacingCss(3)};
    align-items: center;
    flex: 1;

    & > button {
        width: 200px;
    }
`;

const STitle = styled(Title)`
    padding-bottom: ${spacingCss(10)};
`;
