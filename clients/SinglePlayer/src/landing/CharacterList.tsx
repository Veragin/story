import { styled } from '@mui/material';
import type { TCharacterId } from '@story/types';
import { Column, spacingCss } from '@story/ui';
import { CharacterButton } from './CharacterButton';

type Props = {
    characters: readonly TCharacterId[];
    selectedId: TCharacterId;
    onSelect: (id: TCharacterId) => void;
};

export const CharacterList = ({ characters, selectedId, onSelect }: Props) => (
    <SList>
        {characters.map((id) => (
            <CharacterButton
                key={id}
                characterId={id}
                isSelected={id === selectedId}
                onSelect={onSelect}
            />
        ))}
    </SList>
);

const SList = styled(Column)`
    flex: 0 1 240px;
    min-width: 180px;
    gap: ${spacingCss(1)};
`;
