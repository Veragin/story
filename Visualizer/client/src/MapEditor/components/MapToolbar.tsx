import {
    Button,
    ButtonGroup,
    Chip,
    IconButton,
    Slider,
    Tooltip,
} from '@mui/material';
import BrushIcon from '@mui/icons-material/Brush';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import NearMeIcon from '@mui/icons-material/NearMe';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import PentagonIcon from '@mui/icons-material/Pentagon';
import RedoIcon from '@mui/icons-material/Redo';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import { Row, spacingCss } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { Box } from '@mui/material';
import type { MapStore, TMapTool } from '../MapStore';

/**
 * The map tab's toolbar (VISUALIZER_PLAN §6's map rows).
 *
 * Replaces the tile palette, the minimap toggle and the three "modes" the old editor had.
 * Those existed to serve a tile grid; what a polygon map needs is a tool picker, a colour, and
 * a way to save.
 */

const TOOLS: {
    name: TMapTool;
    label: string;
    icon: JSX.Element;
    hint: string;
}[] = [
    {
        name: 'select',
        label: 'Select',
        icon: <NearMeIcon fontSize="small" />,
        hint: 'Click to select, drag to move, double-click to open',
    },
    {
        name: 'polygon-draw',
        label: 'Draw',
        icon: <PentagonIcon fontSize="small" />,
        hint: 'Click to add a vertex, Enter or click the first vertex to close',
    },
    {
        name: 'vertex-edit',
        label: 'Reshape',
        icon: <EditIcon fontSize="small" />,
        hint: 'Drag a vertex, click an edge to insert, alt-click to remove',
    },
    {
        name: 'brush',
        label: 'Brush',
        icon: <BrushIcon fontSize="small" />,
        hint: 'Hold to draw a river or a road',
    },
    {
        name: 'note',
        label: 'Note',
        icon: <NoteAddIcon fontSize="small" />,
        hint: 'Click to place a label',
    },
];

/** A small fixed palette. The tile editor's editable palette is gone with the tile model. */
const COLORS = [
    '#4f7fd4',
    '#2e9e5b',
    '#c9a227',
    '#c0504d',
    '#8e6bbf',
    '#3f6fa8',
    '#7a5c3d',
    '#5b6770',
];

export const MapToolbar = observer(({ store }: { store: MapStore }) => (
    <Row sx={{ gap: spacingCss(1), alignItems: 'center', flexWrap: 'wrap' }}>
        <ButtonGroup size="small">
            {TOOLS.map((tool) => (
                <Tooltip key={tool.name} title={_(tool.hint)}>
                    <Button
                        startIcon={tool.icon}
                        variant={
                            store.activeTool === tool.name
                                ? 'contained'
                                : 'outlined'
                        }
                        onClick={() => store.setTool(tool.name)}
                    >
                        {_(tool.label)}
                    </Button>
                </Tooltip>
            ))}
        </ButtonGroup>

        <Row sx={{ gap: spacingCss(0.5), alignItems: 'center' }}>
            {COLORS.map((color) => (
                <Box
                    key={color}
                    component="button"
                    aria-label={color}
                    title={color}
                    onClick={() => store.setColor(color)}
                    sx={{
                        width: 20,
                        height: 20,
                        borderRadius: '4px',
                        background: color,
                        cursor: 'pointer',
                        border:
                            store.color === color
                                ? '2px solid #fff'
                                : '1px solid rgba(255,255,255,0.3)',
                    }}
                />
            ))}
        </Row>

        {/* Brush size, shown only when it can do anything — README: "brush tool — colour, size". */}
        {store.activeTool === 'brush' && (
            <Row
                sx={{ gap: spacingCss(1), alignItems: 'center', minWidth: 140 }}
            >
                <Slider
                    size="small"
                    min={1}
                    max={40}
                    value={store.brushWidth}
                    onChange={(_event, value) =>
                        store.setBrushWidth(value as number)
                    }
                    aria-label={_('Brush size')}
                />
            </Row>
        )}

        <ButtonGroup size="small">
            <Tooltip title={_('Undo (Ctrl+Z)')}>
                {/* `span` because a disabled MUI button swallows the tooltip's events. */}
                <span>
                    <IconButton
                        size="small"
                        disabled={!store.canUndo}
                        onClick={store.undo}
                    >
                        <UndoIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title={_('Redo (Ctrl+Shift+Z)')}>
                <span>
                    <IconButton
                        size="small"
                        disabled={!store.canRedo}
                        onClick={store.redo}
                    >
                        <RedoIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title={_('Delete selection (Del)')}>
                <IconButton size="small" onClick={store.deleteSelection}>
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title={_('Fit the map on screen')}>
                <IconButton size="small" onClick={store.fit}>
                    <CenterFocusStrongIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </ButtonGroup>

        <Tooltip
            title={
                store.isDirty
                    ? _('Write the changes to data/')
                    : _('Nothing to save')
            }
        >
            <span>
                <Button
                    size="small"
                    variant="contained"
                    color={store.isDirty ? 'primary' : 'inherit'}
                    startIcon={<SaveIcon fontSize="small" />}
                    disabled={!store.isDirty || store.saving}
                    onClick={() => void store.save()}
                >
                    {store.saving ? _('Saving…') : _('Save')}
                </Button>
            </span>
        </Tooltip>

        {store.isDirty && (
            <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={_(
                    '%s unsaved',
                    String(
                        store.dirtyLocationIds.size + (store.mapDirty ? 1 : 0)
                    )
                )}
            />
        )}
    </Row>
));
