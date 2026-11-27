import { observer } from 'mobx-react-lite';
import type { MapStore } from '../MapStore';
import { HintText } from '../../components/feedback/HintText';
import { FormFields } from '../../components/form/FormFields';
import { FormTextInput } from '../../components/form/FormTextInput';
import { PanelSection } from '../../components/layout/PanelSection';

type TProps = {
    mapStore: MapStore;
};

export const EditWidget = observer(({ mapStore }: TProps) => {
    const selectedTile = mapStore.selectedTile;
    // re-render on every edit and on live refresh: the document itself is not observable
    void mapStore.revision;

    const tile = selectedTile ? mapStore.getTile(selectedTile) : undefined;
    if (!selectedTile || !tile) {
        return (
            <PanelSection>
                <HintText>
                    {_('Click a tile to edit its label and description.')}
                </HintText>
            </PanelSection>
        );
    }
    const color = mapStore.data?.palette[tile.tile];

    return (
        <PanelSection
            label={`${selectedTile.i}, ${selectedTile.j} · ${color?.name ?? tile.tile}`}
        >
            <FormFields data-testid="tile-edit-widget">
                <FormTextInput
                    label={_('Label')}
                    value={tile.label ?? ''}
                    onChange={(label = '') =>
                        mapStore.setTileText(selectedTile, { label })
                    }
                    dataField="label"
                />
                <FormTextInput
                    label={_('Description')}
                    value={tile.description ?? ''}
                    onChange={(description = '') =>
                        mapStore.setTileText(selectedTile, { description })
                    }
                    multiline
                    minRows={3}
                    dataField="description"
                />
            </FormFields>
        </PanelSection>
    );
});
