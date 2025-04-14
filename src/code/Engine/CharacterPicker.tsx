import { Button, styled } from '@mui/material';
import { Column, WholeContainer } from 'code/components/Basic';
import { spacingCss } from 'code/components/css';
import { Title } from 'code/components/Text';
import { useEngine } from 'code/Context';

export const CharacterPicker = () => {
    const e = useEngine();

    return (
        <WholeContainer>
            <SContainer>
                <STitle>Choose a character</STitle>
                Thomas
                <Button
                    variant="contained"
                    onClick={() => e.processor.continue()}
                >
                    Start
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
