import { useEffect, useRef, useState } from 'react';
import { Button, styled } from '@mui/material';
import { Camera } from '../Camera';
import { LineTool } from '../controllers/LineTool';
import { SelectionController } from '../controllers/SelectionController';
import { VertexEditController } from '../controllers/VertexEditController';
import { isTypingTarget } from '../input';
import { Scene } from '../Scene';
import { LineShape } from '../shapes/LineShape';
import { PolygonShape } from '../shapes/PolygonShape';
import { RectShape } from '../shapes/RectShape';
import type { Shape } from '../shapes/Shape';
import { TextShape } from '../shapes/TextShape';

/**
 * Dev playground for the Canvas library (`#/_canvas`). Not translated: it is a developer tool.
 * Shows polygons with vertex editing, resizable rects, anchored arrows, text, the line tool,
 * the editable toggle, hover tooltips and the event stream.
 */

type TDemo = { tooltip: string };

type TTooltip = { text: string; x: number; y: number } | null;

type TRig = {
    scene: Scene;
    selection: SelectionController;
    lineTool: LineTool;
};

function buildDemo(scene: Scene): void {
    const tip = (tooltip: string): TDemo => ({ tooltip });
    const stroke = { color: '#ffffff88', width: 2, screenWidth: true };

    scene.layer('areas', 0);
    scene.layer('boxes', 1);
    scene.layer('labels', 2);

    scene.add(
        new PolygonShape<TDemo>({
            id: 'forest',
            points: [
                { x: 60, y: 60 },
                { x: 300, y: 40 },
                { x: 340, y: 220 },
                { x: 180, y: 300 },
                { x: 40, y: 220 },
            ],
            fill: '#2e7d3288',
            stroke,
            hoverStyle: { fill: '#2e7d32bb' },
            draggable: true,
            label: 'Forest',
            data: tip(
                'Polygon: select it, drag handles, double-click an edge to add, right-click a handle to remove'
            ),
        }),
        'areas'
    );
    scene.add(
        new PolygonShape<TDemo>({
            id: 'lake',
            points: [
                { x: 420, y: 80 },
                { x: 560, y: 60 },
                { x: 620, y: 180 },
                { x: 500, y: 240 },
            ],
            fill: '#1565c088',
            stroke: { ...stroke, dash: [6, 4] },
            hoverStyle: { fill: '#1565c0bb' },
            draggable: true,
            label: 'Lake',
            data: tip('Dashed polygon'),
        }),
        'areas'
    );

    const boxStyle = {
        height: 50,
        fill: '#6a1b9a',
        stroke: { color: '#ce93d8', width: 1, screenWidth: true },
        cornerRadius: 6,
        draggable: true,
        resizeEdges: ['left', 'right'] as const,
        minWidth: 40,
    };
    const prologue = scene.add(
        new RectShape<TDemo>({
            ...boxStyle,
            resizeEdges: [...boxStyle.resizeEdges],
            id: 'prologue',
            x: 80,
            y: 380,
            width: 180,
            label: 'Prologue',
            drag: { axis: 'x' },
            data: tip('Rect: horizontal-only drag, resize by left/right edge'),
        }),
        'boxes'
    );
    const village = scene.add(
        new RectShape<TDemo>({
            ...boxStyle,
            resizeEdges: [...boxStyle.resizeEdges],
            id: 'village',
            x: 360,
            y: 460,
            width: 220,
            label: 'Village',
            fill: '#00695c',
            // snap to a 20-unit grid
            drag: {
                constrain: (p) => ({
                    x: Math.round(p.x / 20) * 20,
                    y: Math.round(p.y / 20) * 20,
                }),
            },
            constrainResize: (r) => ({
                ...r,
                x: Math.round(r.x / 20) * 20,
                width: Math.round(r.width / 20) * 20,
            }),
            data: tip('Rect: free drag snapped to a 20-unit grid'),
        }),
        'boxes'
    );
    scene.add(
        new LineShape<TDemo>({
            id: 'prologue->village',
            from: { shape: prologue },
            to: { shape: village },
            arrow: 'end',
            stroke: { color: '#ffcc80', width: 2, screenWidth: true },
            selectable: false,
            data: tip('Line anchored to both rects'),
        }),
        'boxes'
    );
    scene.add(
        new LineShape<TDemo>({
            id: 'free-line',
            from: { x: 660, y: 300 },
            to: { x: 760, y: 420 },
            arrow: 'both',
            stroke: { color: '#90caf9', width: 3 },
            draggable: true,
            data: tip('Free line, draggable when selected'),
        }),
        'boxes'
    );
    scene.add(
        new TextShape<TDemo>({
            id: 'title',
            x: 40,
            y: 0,
            text: 'Canvas playground',
            fontSize: 22,
            fontWeight: 'bold',
            draggable: true,
            data: tip('Text shape'),
        }),
        'labels'
    );
}

export const CanvasPlayground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rigRef = useRef<TRig | null>(null);
    const [editable, setEditable] = useState(true);
    const [lineActive, setLineActive] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [tooltip, setTooltip] = useState<TTooltip>(null);
    const [log, setLog] = useState<string[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const camera = new Camera({ x: -20, y: -60, zoom: 1 });
        const scene = new Scene(canvas, { camera, background: '#111' });
        const selection = new SelectionController(scene);
        const vertexEdit = new VertexEditController(scene, selection);
        const lineTool = new LineTool(scene, { arrow: 'end' });
        rigRef.current = { scene, selection, lineTool };
        buildDemo(scene);

        const push = (line: string) => setLog((l) => [line, ...l].slice(0, 12));
        const tooltipFor = (s: Shape | null) =>
            (s?.data as TDemo | undefined)?.tooltip;
        const offs = [
            camera.subscribe((s) => setZoom(s.zoom)),
            lineTool.events.on('state', ({ active }) => setLineActive(active)),
            scene.events.on('select', ({ shape }) => {
                setSelected(shape?.id ?? null);
                push(`select ${shape?.id ?? '∅'}`);
            }),
            scene.events.on('change', ({ shape, kind, final }) => {
                if (final) push(`change ${shape.id} ${kind}`);
            }),
            scene.events.on('action', ({ shape }) =>
                push(`action ${shape.id}`)
            ),
            scene.events.on('create', ({ shape }) =>
                push(`create ${shape.id}`)
            ),
            scene.events.on('pointermove', ({ shape, screen }) => {
                const text = tooltipFor(shape);
                setTooltip(
                    text ? { text, x: screen.x + 14, y: screen.y + 14 } : null
                );
            }),
            scene.events.on('hover', ({ shape }) => {
                if (!shape) setTooltip(null);
            }),
        ];

        const onKey = (e: KeyboardEvent) => {
            if (
                isTypingTarget(e.target) ||
                (e.key !== 'Delete' && e.key !== 'Backspace')
            )
                return;
            const s = selection.selected;
            if (s && scene.editable) scene.remove(s);
        };
        window.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('keydown', onKey);
            offs.forEach((off) => off());
            vertexEdit.destroy();
            lineTool.destroy();
            selection.destroy();
            scene.destroy();
            rigRef.current = null;
        };
    }, []);

    const toggleEditable = () => {
        const rig = rigRef.current;
        if (!rig) return;
        rig.scene.editable = !rig.scene.editable;
        setEditable(rig.scene.editable);
    };

    const addPolygon = () => {
        const rig = rigRef.current;
        if (!rig) return;
        const c = rig.scene.viewCenter();
        const r = 60 / rig.scene.camera.zoom;
        const shape = rig.scene.add(
            new PolygonShape<TDemo>({
                points: [0, 1, 2, 3, 4, 5].map((i) => ({
                    x: c.x + r * Math.cos((i * Math.PI) / 3),
                    y: c.y + r * Math.sin((i * Math.PI) / 3),
                })),
                fill: '#ef6c0088',
                stroke: { color: '#ffb74d', width: 2, screenWidth: true },
                draggable: true,
                label: 'New',
                data: { tooltip: 'Added polygon' },
            }),
            'areas'
        );
        rig.selection.select(shape);
    };

    const fitAll = () => {
        const rig = rigRef.current;
        if (!rig) return;
        const shapes = rig.scene.getShapes();
        if (shapes.length === 0) return;
        const b = shapes.map((s) => s.getBounds());
        const minX = Math.min(...b.map((r) => r.x));
        const minY = Math.min(...b.map((r) => r.y));
        const maxX = Math.max(...b.map((r) => r.x + r.width));
        const maxY = Math.max(...b.map((r) => r.y + r.height));
        rig.scene.camera.fitRect(
            { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
            rig.scene.size,
            40
        );
    };

    return (
        <SRoot>
            <SToolbar>
                <Button
                    size="small"
                    variant={editable ? 'contained' : 'outlined'}
                    onClick={toggleEditable}
                >
                    {editable ? 'Editable' : 'View mode'}
                </Button>
                <Button
                    size="small"
                    variant={lineActive ? 'contained' : 'outlined'}
                    disabled={!editable}
                    onClick={() => rigRef.current?.lineTool.toggle()}
                >
                    Line tool
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    disabled={!editable}
                    onClick={addPolygon}
                >
                    Add polygon
                </Button>
                <Button size="small" variant="outlined" onClick={fitAll}>
                    Fit
                </Button>
                <SInfo>
                    selected: {selected ?? '—'} · zoom {zoom.toFixed(2)} ·
                    WASD/arrows/drag to pan, wheel to zoom, Delete removes, Esc
                    clears
                </SInfo>
            </SToolbar>
            <SStage>
                <SCanvas ref={canvasRef} />
                {tooltip && (
                    <STooltip style={{ left: tooltip.x, top: tooltip.y }}>
                        {tooltip.text}
                    </STooltip>
                )}
                <SLog>
                    {log.map((l, i) => (
                        <div key={i}>{l}</div>
                    ))}
                </SLog>
            </SStage>
        </SRoot>
    );
};

export default CanvasPlayground;

const SRoot = styled('div')`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: #000;
    color: #eee;
`;

const SToolbar = styled('div')`
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px;
    flex-wrap: wrap;
`;

const SInfo = styled('span')`
    font-size: 12px;
    opacity: 0.7;
`;

const SStage = styled('div')`
    position: relative;
    flex: 1;
    min-height: 0;
`;

const SCanvas = styled('canvas')`
    display: block;
    width: 100%;
    height: 100%;
`;

const STooltip = styled('div')`
    position: absolute;
    pointer-events: none;
    max-width: 260px;
    padding: 4px 8px;
    border-radius: 4px;
    background: #333e;
    font-size: 12px;
`;

const SLog = styled('div')`
    position: absolute;
    right: 8px;
    bottom: 8px;
    pointer-events: none;
    font: 11px monospace;
    opacity: 0.6;
    text-align: right;
`;
