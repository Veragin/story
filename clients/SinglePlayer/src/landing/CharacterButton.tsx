import { ButtonBase, styled } from '@mui/material';
import type { TCharacterId } from '@story/types';
import { spacingCss } from '@story/ui';
import { useEngine } from '../context';

type Props = {
    characterId: TCharacterId;
    isSelected: boolean;
    onSelect: (id: TCharacterId) => void;
};

export const CharacterButton = ({
    characterId,
    isSelected,
    onSelect,
}: Props) => {
    const e = useEngine();

    return (
        <SButton
            focusRipple
            aria-pressed={isSelected}
            className={isSelected ? 'selected' : undefined}
            onClick={() => onSelect(characterId)}
        >
            {e.storyModule.register.characters[characterId].name}
        </SButton>
    );
};

const SButton = styled(ButtonBase)`
    justify-content: flex-start;
    padding: ${spacingCss(1.5)} ${spacingCss(2)};
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background-color: rgba(0, 29, 61, 0.75);
    color: #fff;
    font-size: 20px;
    font-weight: 500;
    text-align: left;
    transition:
        border-color 0.15s,
        background-color 0.15s;

    &:hover,
    &.Mui-focusVisible {
        background-color: rgba(0, 53, 102, 0.9);
    }

    &.selected {
        border-color: #ffc300;
        background-color: rgba(0, 53, 102, 0.9);
        color: #ffc300;
    }
`;
