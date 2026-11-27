import { Avatar, styled } from '@mui/material';
import { describeMentions } from '@story/shared';
import type { TCharacterId } from '@story/types';
import { Column, spacingCss } from '@story/ui';
import { useEngine } from '../context';
import { characterImage } from '../images';
import { mentionNameOf } from '../mentionNames';

type Props = {
    characterId: TCharacterId;
};

export const CharacterDetail = ({ characterId }: Props) => {
    const e = useEngine();
    const character = e.storyModule.register.characters[characterId];

    return (
        <SDetail>
            <SPortrait
                variant="rounded"
                src={characterImage(characterId)}
                alt={describeMentions(
                    character.image ?? character.name,
                    mentionNameOf(e.storyModule)
                )}
            >
                {character.name.charAt(0)}
            </SPortrait>
            {character.description && (
                <SDescription>{character.description}</SDescription>
            )}
        </SDetail>
    );
};

const SDetail = styled(Column)`
    flex: 1 1 320px;
    min-width: 0;
    gap: ${spacingCss(2)};
`;

const SPortrait = styled(Avatar)`
    width: min(480px, 100%);
    height: auto;
    aspect-ratio: 1;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    font-size: 120px;
    background-color: #003566;
    color: #ffc300;
`;

const SDescription = styled('p')`
    margin: 0;
    font-size: 18px;
    line-height: 1.6;
    white-space: pre-line;
    color: rgba(255, 255, 255, 0.9);
`;
