import { Button, styled } from '@mui/material';
import { Column, spacingCss, Title, WholeContainer } from '@story/ui';
import { useEngine } from './context';

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
