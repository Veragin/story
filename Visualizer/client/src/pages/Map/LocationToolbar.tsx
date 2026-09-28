import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
import { Button, Tooltip } from '@mui/material';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { Row, SmallText, spacingCss } from '@story/ui';
import { locationColor, type MapPageStore } from './MapPageStore';

type Props = {
    store: MapPageStore;
    onAdd: () => void;
    onOpen: (locationId: string) => void;
    onDelete: (locationId: string) => void;
};

/** The tooling row of the `locations` mode: add, colour, open, delete. */
export const LocationToolbar = observer(
    ({ store, onAdd, onOpen, onDelete }: Props) => {
        const id = store.selectedLocationId;
        void store.revision;
        const shape = id ? store.map?.locations[id] : undefined;
        const color = id ? locationColor(id, shape) : '#888888';

        return (
            <>
                <Button
                    size="small"
                    variant="contained"
                    startIcon={<AddLocationAltIcon />}
                    onClick={onAdd}
                >
                    {_('Add location')}
                </Button>
                <Tooltip title={_('Location colour')}>
                    <SColorLabel $disabled={!shape}>
                        <SColorInput
                            type="color"
                            value={color}
                            disabled={!shape}
                            aria-label={_('Location colour')}
                            onChange={(e) =>
                                id && store.setLocationColor(id, e.target.value)
                            }
                        />
                        <SSwatch style={{ backgroundColor: color }} />
                    </SColorLabel>
                </Tooltip>
                <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    startIcon={<OpenInNewIcon />}
                    disabled={!id}
                    onClick={() => id && onOpen(id)}
                >
                    {_('Open')}
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteRoundedIcon />}
                    disabled={!id}
                    onClick={() => id && onDelete(id)}
                >
                    {_('Delete')}
                </Button>
                <SmallText>
                    {id
                        ? _('Selected: %s', store.locationName(id))
                        : _('Click a location to select it.')}
                </SmallText>
            </>
        );
    }
);

const SColorLabel = styled.label<{ $disabled: boolean }>`
    position: relative;
    display: inline-flex;
    cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
    opacity: ${({ $disabled }) => ($disabled ? 0.4 : 1)};
`;

const SColorInput = styled.input`
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: inherit;
`;

const SSwatch = styled.span`
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 2px solid #fff;
`;

export const SToolRow = styled(Row)`
    gap: ${spacingCss(1.5)};
    align-items: center;
    padding: ${spacingCss(0.75)} ${spacingCss(1.5)};
    background-color: #1d1d1d;
    border-bottom: 1px solid #333;
    color: #fff;
    min-height: 44px;
    flex-wrap: wrap;
`;
