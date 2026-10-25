import { Avatar, ButtonBase, styled } from '@mui/material';
import type { TCharacterId } from '@story/types';
import { Column, spacingCss } from '@story/ui';
import { useEngine } from '../context';
import { characterImage } from '../images';

type Props = {
    characterId: TCharacterId;
};

export const CharacterButton = ({ characterId }: Props) => {
    const e = useEngine();
    const character = e.storyModule.register.characters[characterId];

    return (
        <SButton focusRipple onClick={() => void e.startAs(characterId)}>
            <SPortrait
                src={characterImage(characterId)}
                alt={character.image ?? character.name}
            >
                {character.name.charAt(0)}
            </SPortrait>
            <SText>
                <SName>{character.name}</SName>
                {character.description && (
                    <SDescription>{character.description}</SDescription>
                )}
            </SText>
        </SButton>
    );
};

const SButton = styled(ButtonBase)`
    justify-content: flex-start;
    align-items: center;
    gap: ${spacingCss(2)};
    padding: ${spacingCss(2)};
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background-color: rgba(0, 29, 61, 0.75);
    color: #fff;
    text-align: left;
    transition:
        border-color 0.15s,
        background-color 0.15s;

    &:hover,
    &.Mui-focusVisible {
        border-color: #ffc300;
        background-color: rgba(0, 53, 102, 0.9);
    }
`;

const SPortrait = styled(Avatar)`
    width: 72px;
    height: 72px;
    flex-shrink: 0;
    font-size: 32px;
    background-color: #003566;
    color: #ffc300;
`;

const SText = styled(Column)`
    gap: ${spacingCss(0.5)};
    min-width: 0;
`;

const SName = styled('span')`
    font-size: 22px;
    font-weight: 500;
`;

const SDescription = styled('span')`
    font-size: 15px;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.75);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
`;
