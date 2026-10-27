import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
import { IconButton, Tooltip } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { Row, spacingCss } from '@story/ui';
import { ColorSwatchInput } from '../../components/ColorSwatchInput';
import { ToolWindow } from '../../MapEditor/components/ToolWindow/ToolWindow';
import { ToolSection } from '../../MapEditor/components/ToolWindow/ToolSection';
import { ToolHint } from '../../MapEditor/components/ToolWindow/ToolHint';
import { locationColor, type MapPageStore } from './MapPageStore';
import { LocationNameEditor } from './LocationNameEditor';

type Props = {
    store: MapPageStore;
    onAdd: () => void;
    onOpen: (locationId: string) => void;
    onEdit: (locationId: string) => void;
    onDelete: (locationId: string) => void;
};

export const LocationTools = observer(
    ({ store, onAdd, onOpen, onEdit, onDelete }: Props) => {
        const id = store.selectedLocationId;
        void store.revision;
        const shape = id ? store.map?.locations[id] : undefined;

        return (
            <ToolWindow
                title={_('Locations')}
                actions={
                    <Tooltip title={_('Add location')}>
                        <IconButton
                            size="small"
                            color="inherit"
                            onClick={onAdd}
                            aria-label={_('Add location')}
                        >
                            <AddRoundedIcon />
                        </IconButton>
                    </Tooltip>
                }
            >
                <ToolSection>
                    {id && shape ? (
                        <SRow key={id}>
                            <ColorSwatchInput
                                label={_('Location colour')}
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
                            <Tooltip title={_('Open')}>
                                <IconButton
                                    size="small"
                                    color="inherit"
                                    onClick={() => onOpen(id)}
                                    aria-label={_('Open')}
                                >
                                    <OpenInNewIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={_('Delete')}>
                                <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => onDelete(id)}
                                    aria-label={_('Delete')}
                                >
                                    <DeleteRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </SRow>
                    ) : (
                        <ToolHint>
                            {_('Click a location on the map to select it.')}
                        </ToolHint>
                    )}
                </ToolSection>
            </ToolWindow>
        );
    }
);

const SRow = styled(Row)`
    align-items: center;
    gap: ${spacingCss(0.75)};
    margin-right: ${spacingCss(-0.75)};
`;
