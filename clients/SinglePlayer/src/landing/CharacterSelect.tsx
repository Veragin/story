import { Alert, Button, styled } from '@mui/material';
import { useState } from 'react';
import { playableCharacters } from '@story/core';
import type { TCharacterId } from '@story/types';
import { Column, Row, spacingCss } from '@story/ui';
import { useEngine } from '../context';
import { CharacterDetail } from './CharacterDetail';
import { CharacterList } from './CharacterList';

export const CharacterSelect = () => {
    const e = useEngine();
    const characters = playableCharacters(e.storyModule.register);
    const [selectedId, setSelectedId] = useState<TCharacterId | undefined>(
        characters[0]
    );

    return (
        <SSection>
            <SSectionTitle>{_('Choose a character')}</SSectionTitle>
            {selectedId === undefined ? (
                <Alert severity="info">
                    {_('This story has no playable character yet.')}
                </Alert>
            ) : (
                <>
                    <SBody>
                        <CharacterList
                            characters={characters}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                        />
                        <CharacterDetail characterId={selectedId} />
                    </SBody>
                    <SChooseButton
                        variant="contained"
                        color="secondary"
                        size="large"
                        onClick={() => void e.startAs(selectedId)}
                    >
                        {_('Choose')}
                    </SChooseButton>
                </>
            )}
        </SSection>
    );
};

const SSection = styled(Column)`
    gap: ${spacingCss(2)};
`;

const SSectionTitle = styled('h2')`
    margin: 0;
    font-size: 28px;
    font-weight: 500;
`;

const SBody = styled(Row)`
    flex-wrap: wrap;
    align-items: flex-start;
    gap: ${spacingCss(4)};
`;

const SChooseButton = styled(Button)`
    align-self: center;
    min-width: 200px;
    margin-top: ${spacingCss(4)};
`;
