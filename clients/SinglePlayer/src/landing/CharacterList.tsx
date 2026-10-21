import { Alert, styled } from '@mui/material';
import { playableCharacters } from '@story/core';
import { spacingCss } from '@story/ui';
import { useEngine } from '../context';
import { CharacterButton } from './CharacterButton';

export const CharacterList = () => {
    const e = useEngine();
    const characters = playableCharacters(e.storyModule.register);

    if (characters.length === 0) {
        return (
            <Alert severity="info">
                {_('This story has no playable character yet.')}
            </Alert>
        );
    }

    return (
        <SGrid>
            {characters.map((id) => (
                <CharacterButton key={id} characterId={id} />
            ))}
        </SGrid>
    );
};

const SGrid = styled('div')`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
    gap: ${spacingCss(2)};
`;
