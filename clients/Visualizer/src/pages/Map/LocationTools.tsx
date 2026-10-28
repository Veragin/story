import { observer } from 'mobx-react-lite';
import { styled } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { spacingCss } from '@story/ui';
import { AddButton } from '../../components/buttons/AddButton';
import { DeleteButton } from '../../components/buttons/DeleteButton';
import { TooltipIconButton } from '../../components/buttons/TooltipIconButton';
import { ColorInput } from '../../components/inputs/ColorInput';
import { Panel } from '../../components/layout/Panel';
import { PanelSection } from '../../components/layout/PanelSection';
import { HintText } from '../../components/feedback/HintText';
import { locationColor, type MapPageStore } from './MapPageStore';
import { LocationNameEditor } from './LocationNameEditor';

type TProps = {
    store: MapPageStore;
    onAdd: () => void;
    onOpen: (locationId: string) => void;
    onEdit: (locationId: string) => void;
    onDelete: (locationId: string) => void;
};

export const LocationTools = observer(
    ({ store, onAdd, onOpen, onEdit, onDelete }: TProps) => {
        const id = store.selectedLocationId;
        void store.revision;
        const shape = id ? store.map?.locations[id] : undefined;

        return (
            <Panel
                title={_('Locations')}
                actions={
                    <AddButton
                        iconOnly
                        label={_('Add location')}
                        tone="inherit"
                        onClick={onAdd}
                    />
                }
            >
                <PanelSection>
                    {id && shape ? (
                        <SRow key={id}>
                            <ColorInput
                                ariaLabel={_('Location colour')}
                                value={locationColor(id, shape)}
                                onChange={(color) =>
                                    store.setLocationColor(id, color)
                                }
                            />
                            <LocationNameEditor
                                store={store}
                                locationId={id}
                                onEditInForm={onEdit}
                            />
                            <TooltipIconButton
                                title={_('Open')}
                                icon={OpenInNewIcon}
                                tone="inherit"
                                onClick={() => onOpen(id)}
                            />
                            <DeleteButton
                                iconOnly
                                tone="error"
                                onClick={() => onDelete(id)}
                            />
                        </SRow>
                    ) : (
                        <HintText>
                            {_('Click a location on the map to select it.')}
                        </HintText>
                    )}
                </PanelSection>
            </Panel>
        );
    }
);

const SRow = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(0.75)};
    margin-right: ${spacingCss(-0.75)};
`;
