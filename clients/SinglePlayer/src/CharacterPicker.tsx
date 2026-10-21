import { Button, styled } from '@mui/material';
import { playableCharacters } from '@story/core';
import { Column, spacingCss, Title, WholeContainer } from '@story/ui';
import { useEngine } from './context';

export const CharacterPicker = () => {
    const e = useEngine();
    const { characters } = e.storyModule.register;

    return (
        <WholeContainer>
            <SContainer>
                <STitle>{_('Choose a character')}</STitle>
                {playableCharacters(e.storyModule.register).map((id) => (
                    <Button
                        key={id}
                        variant="contained"
                        onClick={() => void e.startAs(id)}
                    >
                        {characters[id].name}
                    </Button>
                ))}
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
