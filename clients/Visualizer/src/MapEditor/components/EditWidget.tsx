import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
import { Column, LabeledTextField, spacingCss } from '@story/ui';
import type { MapStore } from '../MapStore';
import { ToolSection } from './ToolWindow/ToolSection';
import { ToolHint } from './ToolWindow/ToolHint';

type Props = {
    mapStore: MapStore;
};

export const EditWidget = observer(({ mapStore }: Props) => {
    const selectedTile = mapStore.selectedTile;
    // re-render on every edit and on live refresh: the document itself is not observable
    void mapStore.revision;

    const tile = selectedTile ? mapStore.getTile(selectedTile) : undefined;
    if (!selectedTile || !tile) {
        return (
            <ToolSection>
                <ToolHint>
                    {_('Click a tile to edit its label and description.')}
                </ToolHint>
            </ToolSection>
        );
    }
    const color = mapStore.data?.palette[tile.tile];

    return (
        <ToolSection
            label={`${selectedTile.i}, ${selectedTile.j} · ${color?.name ?? tile.tile}`}
        >
            <SColumn data-testid="tile-edit-widget">
                <LabeledTextField
                    value={tile.label ?? ''}
                    onChange={(e) =>
                        mapStore.setTileText(selectedTile, {
                            label: e.target.value,
                        })
                    }
                    label={_('Label')}
                />
                <LabeledTextField
                    value={tile.description ?? ''}
                    onChange={(e) =>
                        mapStore.setTileText(selectedTile, {
                            description: e.target.value,
                        })
                    }
                    label={_('Description')}
                    multiline
                    minRows={3}
                    maxRows={10}
                />
            </SColumn>
        </ToolSection>
    );
});

const SColumn = styled(Column)`
    gap: ${spacingCss(1.25)};
`;
