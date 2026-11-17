import { observer } from 'mobx-react-lite';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import { TooltipIconButton } from '../../../components/buttons/TooltipIconButton';
import type { IEditorSource } from '../../../components/layout/editorSource';
import { SaveControls } from '../../../components/layout/SaveControls';
import { SidebarToolbar } from '../../../components/layout/SidebarToolbar';
import type { MapPageStore } from '../MapPageStore';

type TProps = {
    store: MapPageStore;
    locationId: string;
    source?: IEditorSource;
    onAddMap: (id: string) => void;
    onDelete: (id: string) => void;
};

export const LocationToolbar = observer(
    ({ store, locationId, source, onAddMap, onDelete }: TProps) => (
        <SidebarToolbar
            start={
                <>
                    <TooltipIconButton
                        title={_('Delete location')}
                        icon={DeleteIcon}
                        tone="error"
                        disabled={source?.saving}
                        onClick={() => onDelete(locationId)}
                        data-action="delete"
                    />
                    {store.locationMaps.get(locationId) === null && (
                        <TooltipIconButton
                            title={_('Add map')}
                            icon={AddIcon}
                            tone="inherit"
                            onClick={() => onAddMap(locationId)}
                            data-action="add-map"
                        />
                    )}
                </>
            }
            end={
                <>
                    {source && <SaveControls store={source} />}
                    <TooltipIconButton
                        title={_('Close')}
                        icon={CloseIcon}
                        tone="inherit"
                        onClick={() => store.selectLocation(null)}
                        data-action="close"
                    />
                </>
            }
        />
    )
);
