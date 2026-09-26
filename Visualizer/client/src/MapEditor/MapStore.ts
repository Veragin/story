import { action, makeObservable, observable } from 'mobx';
import type { Camera } from '../canvas';
import { getUiState, setUiState } from '../ui-state';
import { Draw } from './MapEngine/Draw';
import { MouseListener } from './MapEngine/MouseListener';
import { MAX_BRUSH_SIZE } from './MapEngine/constants';
import { findNeighbor, isInsideMap } from './MapEngine/utils';
import type { TMapDocument, TMapTile, TTile, TTileTool } from './types';

/** What the tile editor needs from the page that owns the map document. */
export interface IMapHost {
    /** The current document (replaced in place on a live refresh), or null while loading. */
    readonly map: TMapDocument | null;
    /** The camera shared with the Locations scene. */
    readonly camera: Camera;
    /** Called after every edit of tiles, tile texts or the palette (the host autosaves). */
    onMapEdited(): void;
}

type TTileUiState = { tool: TTileTool; colorId: string; brushSize: number; showMinimap: boolean };
const UI_STATE_KEY = 'map:tiles';

/**
 * State of the hex tile layer (the mapMaker port): tooling (tool, colour, brush, minimap), the
 * hovered and selected tile, and the renderer + input listener of the tiles canvas. The map data
 * itself belongs to the host (the Map page store); every edit goes through a method here that
 * calls `host.onMapEdited()`, so nothing mutates the document behind the autosave's back.
 */
export class MapStore {
    tool: TTileTool;
    selectedColorId: string;
    brushSize: number;
    showMinimap: boolean;
    selectedTile: TTile | null = null;
    hoverTile: TTile | null = null;
    /** True while the tiles canvas owns pointer input (the page's `tiles` mode). */
    interactive = false;
    /** Bumped on every edit and data replacement, for observers of the (non-observable) document. */
    revision = 0;

    draw: Draw | null = null;
    private listener: MouseListener | null = null;

    constructor(readonly host: IMapHost) {
        const saved = getUiState<Partial<TTileUiState>>(UI_STATE_KEY, {});
        this.tool = saved.tool === 'select' ? 'select' : 'paint';
        this.selectedColorId = typeof saved.colorId === 'string' ? saved.colorId : 'grass';
        this.brushSize = clampBrush(saved.brushSize ?? 2);
        this.showMinimap = saved.showMinimap ?? true;

        makeObservable<MapStore, 'persist'>(this, {
            tool: observable,
            selectedColorId: observable,
            brushSize: observable,
            showMinimap: observable,
            selectedTile: observable,
            hoverTile: observable,
            interactive: observable,
            revision: observable,
            setTool: action,
            setSelectedColorId: action,
            setBrushSize: action,
            toggleShowMinimap: action,
            setSelectedTile: action,
            setHoverTile: action,
            setInteractive: action,
            paint: action,
            setTileText: action,
            setPaletteColor: action,
            deleteColor: action,
            onDataReplaced: action,
            persist: false,
        });
    }

    get data(): TMapDocument | null {
        return this.host.map;
    }

    get camera(): Camera {
        return this.host.camera;
    }

    /** Starts rendering into `canvas` and listening to it. Returns the cleanup. */
    attach = (canvas: HTMLCanvasElement): (() => void) => {
        this.detach();
        this.draw = new Draw(this, canvas, this.host.camera);
        this.listener = new MouseListener(this, canvas, this.host.camera);
        return this.detach;
    };

    /** Stops the render loop and removes every listener. Safe to call twice. */
    detach = () => {
        this.listener?.destroy();
        this.listener = null;
        this.draw?.destroy();
        this.draw = null;
    };

    render = () => {
        this.draw?.render();
    };

    setTool = (tool: TTileTool) => {
        this.tool = tool;
        this.persist();
        this.render();
    };

    setSelectedColorId = (colorId: string) => {
        this.selectedColorId = colorId;
        this.persist();
    };

    setBrushSize = (size: number) => {
        this.brushSize = clampBrush(size);
        this.persist();
        this.render();
    };

    toggleShowMinimap = () => {
        this.showMinimap = !this.showMinimap;
        this.persist();
        this.render();
    };

    setSelectedTile = (tile: TTile | null) => {
        this.selectedTile = tile;
        this.render();
    };

    setHoverTile = (tile: TTile | null) => {
        if (tile?.i === this.hoverTile?.i && tile?.j === this.hoverTile?.j) return;
        this.hoverTile = tile;
        this.render();
    };

    setInteractive = (interactive: boolean) => {
        this.interactive = interactive;
        if (!interactive) this.hoverTile = null;
        this.render();
    };

    /** Tile at `(i, j)`, or undefined outside the map. */
    getTile = (tile: TTile): TMapTile | undefined => this.data?.data[tile.i]?.[tile.j];

    /** Fills the brush around `center` with the selected colour. Returns whether anything changed. */
    paint = (center: TTile): boolean => {
        const map = this.data;
        if (!map || !map.palette[this.selectedColorId]) return false;
        let changed = false;
        for (const t of findNeighbor(center.i, center.j, this.brushSize, map.height, map.width)) {
            const tile = map.data[t.i]?.[t.j];
            if (tile && tile.tile !== this.selectedColorId) {
                tile.tile = this.selectedColorId;
                changed = true;
            }
        }
        if (changed) this.edited();
        return changed;
    };

    /** Sets a tile's label / description; empty strings remove the field. */
    setTileText = (at: TTile, patch: Partial<Pick<TMapTile, 'label' | 'description'>>) => {
        const tile = this.getTile(at);
        if (!tile) return;
        for (const key of ['label', 'description'] as const) {
            if (!(key in patch)) continue;
            const value = patch[key];
            if (value) tile[key] = value;
            else delete tile[key];
        }
        this.edited();
    };

    /** Adds or edits a palette colour and selects it. */
    setPaletteColor = (colorId: string, entry: { name: string; color: string }) => {
        const map = this.data;
        if (!map) return;
        map.palette[colorId] = { ...entry };
        this.selectedColorId = colorId;
        this.persist();
        this.edited();
    };

    /** Deletes the selected colour; its tiles become `none`. */
    deleteColor = () => {
        const map = this.data;
        const colorId = this.selectedColorId;
        if (!map || colorId === 'none') return;
        delete map.palette[colorId];
        for (const row of map.data) {
            for (const tile of row) {
                if (tile.tile === colorId) tile.tile = 'none';
            }
        }
        this.selectedColorId = 'none';
        this.persist();
        this.edited();
    };

    /** The host replaced the document (load, live refresh, merge). */
    onDataReplaced = () => {
        const map = this.data;
        if (map && this.selectedTile && !isInsideMap(map, this.selectedTile)) this.selectedTile = null;
        if (map && this.hoverTile && !isInsideMap(map, this.hoverTile)) this.hoverTile = null;
        this.revision++;
        this.render();
    };

    private edited() {
        this.revision++;
        this.render();
        this.host.onMapEdited();
    }

    private persist() {
        setUiState<TTileUiState>(UI_STATE_KEY, {
            tool: this.tool,
            colorId: this.selectedColorId,
            brushSize: this.brushSize,
            showMinimap: this.showMinimap,
        });
    }
}

const clampBrush = (size: number) => Math.max(1, Math.min(MAX_BRUSH_SIZE, Math.round(size) || 1));
