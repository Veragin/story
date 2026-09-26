import { useEffect, useRef, useState } from 'react';
import type { TChapterId } from '@story/types';
import { reaction } from 'mobx';
import { styled } from '@mui/material';
import {
    Camera,
    isAnchor,
    LineShape,
    RectShape,
    Scene,
    SelectionController,
    type Shape,
    type TCameraState,
} from '../../../canvas';
import { router } from '../../../shell';
import { getUiState, setUiState } from '../../../ui-state';
import { uiKeys, type ChapterGraphStore } from '../ChapterGraphStore';
import { BOX } from './autoLayout';
import { characterColor } from './colors';
import {
    isGhostId,
    type TGhostNode,
    type TGraphEdge,
    type TGraphNode,
} from './buildGraph';

type TShapeData =
    | { kind: 'passage'; node: TGraphNode }
    | { kind: 'ghost'; ghost: TGhostNode }
    | { kind: 'edge'; edge: TGraphEdge };

const TYPE_FILL: Record<TGraphNode['type'], string> = {
    screen: '#1d3557',
    linear: '#1f4d3a',
    transition: '#5a3d1a',
};

const EDGE_COLOR: Record<TGraphEdge['kinds'][number], string> = {
    link: '#9fb3c8',
    redirect: '#f4a261',
    next: '#80cbc4',
};

const nodeLabel = (n: TGraphNode) =>
    `${n.title}\n${n.type}${n.selfLoop ? '  ↻' : ''}`;

type TTooltip = { text: string; x: number; y: number } | null;

/**
 * The chapter graph on the WP3 canvas library: a `RectShape` per passage, a `LineShape` arrow
 * per (deduplicated) static edge, and small dashed boxes for link targets outside the chapter.
 * The shapes follow `store` through a MobX reaction (live refresh updates them in place);
 * dragging a box calls `store.setPosition` (debounced save), double-click opens the passage
 * editor, the camera is kept in `ui-state`.
 */
export const ChapterGraphCanvas = ({ store }: { store: ChapterGraphStore }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [tooltip, setTooltip] = useState<TTooltip>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const cameraKey = uiKeys.camera(store.chapterId);
        const savedCamera = getUiState<TCameraState | null>(cameraKey, null);
        const camera = new Camera({
            ...(savedCamera ?? { x: -40, y: -40, zoom: 1 }),
            minZoom: 0.15,
            maxZoom: 3,
        });
        const scene = new Scene(canvas, { camera, background: '#0d1117' });
        scene.layer('edges', 0);
        scene.layer('boxes', 1);
        const selection = new SelectionController(scene, {
            highlight: { color: '#ffd166', width: 3 },
        });

        // Twine-like: pressing an unselected box selects it, so the same gesture drags it.
        const offPress = scene.addInteraction({
            priority: 10,
            onPointerDown: (e) => {
                if (
                    e.button === 0 &&
                    scene.editable &&
                    e.hit?.selectable &&
                    e.hit !== selection.selected
                ) {
                    selection.select(e.hit);
                }
                return false;
            },
        });

        const boxes = new Map<string, RectShape<TShapeData>>();
        const lines = new Map<string, LineShape<TShapeData>>();
        let dragging: string | null = null;
        let fitted = savedCamera !== null;

        const sync = () => {
            const { nodes, ghosts, edges } = store.graph;
            const positions = store.positions;

            const alive = new Set<string>();
            for (const node of nodes) {
                alive.add(node.id);
                const p = positions[node.id] ?? { x: 0, y: 0 };
                const style = {
                    label: nodeLabel(node),
                    fill: TYPE_FILL[node.type],
                    stroke: {
                        color: characterColor(node.characterId),
                        width: 2,
                        screenWidth: true,
                    },
                    data: { kind: 'passage' as const, node },
                };
                const box = boxes.get(node.id);
                if (box) {
                    box.update(style);
                    if (
                        dragging !== node.id &&
                        (box.x !== p.x || box.y !== p.y)
                    )
                        box.setRect({ x: p.x, y: p.y });
                } else {
                    const shape = new RectShape<TShapeData>({
                        id: node.id,
                        x: p.x,
                        y: p.y,
                        width: BOX.width,
                        height: BOX.height,
                        cornerRadius: 6,
                        draggable: true,
                        cursor: 'pointer',
                        hoverStyle: { fill: '#2b4a73' },
                        labelStyle: { fontSize: 13, color: '#f1f1f1' },
                        ...style,
                    });
                    boxes.set(node.id, scene.add(shape, 'boxes'));
                }
            }
            for (const ghost of ghosts) {
                alive.add(ghost.id);
                const p = positions[ghost.id] ?? { x: 0, y: 0 };
                const style = {
                    label: `${ghost.resolved ? '↗ ' : '✕ '}${ghost.passageId || '?'}`,
                    stroke: {
                        color: ghost.resolved ? '#80cbc4' : '#ef5350',
                        width: 1.5,
                        dash: [5, 4],
                        screenWidth: true,
                    },
                    data: { kind: 'ghost' as const, ghost },
                };
                const box = boxes.get(ghost.id);
                if (box) {
                    box.update(style);
                    box.setRect({ x: p.x, y: p.y });
                } else {
                    const shape = new RectShape<TShapeData>({
                        id: ghost.id,
                        x: p.x,
                        y: p.y,
                        width: BOX.width,
                        height: BOX.height / 2,
                        cornerRadius: 4,
                        fill: '#0d1117',
                        selectable: false,
                        cursor: ghost.resolved ? 'pointer' : undefined,
                        labelStyle: { fontSize: 11, color: '#bbb' },
                        ...style,
                    });
                    boxes.set(ghost.id, scene.add(shape, 'boxes'));
                }
            }
            for (const [id, box] of boxes) {
                if (!alive.has(id)) {
                    scene.remove(box);
                    boxes.delete(id);
                }
            }

            const liveEdges = new Set<string>();
            for (const edge of edges) {
                const from = boxes.get(edge.from);
                const to = boxes.get(edge.to);
                if (!from || !to) continue;
                liveEdges.add(edge.id);
                const color = edge.resolved
                    ? EDGE_COLOR[edge.kinds[0]]
                    : '#ef5350';
                const style = {
                    stroke: {
                        color,
                        width: 2,
                        screenWidth: true,
                        dash: edge.conditional ? [6, 4] : undefined,
                    },
                    label: edge.count > 1 ? `×${edge.count}` : undefined,
                    data: { kind: 'edge' as const, edge },
                };
                const line = lines.get(edge.id);
                if (
                    line &&
                    isAnchor(line.from) &&
                    line.from.shape === from &&
                    isAnchor(line.to) &&
                    line.to.shape === to
                ) {
                    line.update(style);
                } else {
                    if (line) scene.remove(line);
                    lines.set(
                        edge.id,
                        scene.add(
                            new LineShape<TShapeData>({
                                id: `edge:${edge.id}`,
                                from: { shape: from },
                                to: { shape: to },
                                arrow: 'end',
                                selectable: false,
                                interactive: false,
                                ...style,
                            }),
                            'edges'
                        )
                    );
                }
            }
            for (const [id, line] of lines) {
                if (!liveEdges.has(id)) {
                    scene.remove(line);
                    lines.delete(id);
                }
            }

            // selection follows the store (restored from ui-state, set by dialogs)
            const wanted = store.selectedId
                ? (boxes.get(store.selectedId) ?? null)
                : null;
            if (selection.selected !== wanted) selection.select(wanted);

            applyOffsets();
            if (!fitted && nodes.length > 0) {
                fitted = true;
                fitView();
            }
        };

        /** Two passages linking both ways: shift both arrows sideways so they do not overlap. */
        const applyOffsets = () => {
            for (const line of lines.values()) {
                const data = line.data;
                if (
                    data.kind !== 'edge' ||
                    !isAnchor(line.from) ||
                    !isAnchor(line.to)
                )
                    continue;
                const { from, to } = data.edge;
                let offset: { x: number; y: number } | undefined;
                if (lines.has(`${to}->${from}`)) {
                    const a = line.from.shape.getCenter();
                    const b = line.to.shape.getCenter();
                    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
                    offset = {
                        x: (-(b.y - a.y) / len) * 7,
                        y: ((b.x - a.x) / len) * 7,
                    };
                }
                line.from = { shape: line.from.shape, offset };
                line.to = { shape: line.to.shape, offset };
                line.invalidate();
            }
        };

        /** First visit: show the whole graph, at most at 100 %, anchored top-left. */
        const fitView = () => {
            if (scene.isDestroyed) return;
            if (scene.size.width === 0) {
                requestAnimationFrame(fitView);
                return;
            }
            const b = [...boxes.values()].map((s) => s.getBounds());
            if (b.length === 0) return;
            const minX = Math.min(...b.map((r) => r.x));
            const minY = Math.min(...b.map((r) => r.y));
            const maxX = Math.max(...b.map((r) => r.x + r.width));
            const maxY = Math.max(...b.map((r) => r.y + r.height));
            camera.fitRect(
                { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
                scene.size,
                40
            );
            if (camera.zoom > 1)
                camera.set({ zoom: 1, x: minX - 40, y: minY - 40 });
        };

        const disposeSync = reaction(
            () => [store.graph, store.positions, store.selectedId] as const,
            sync,
            { fireImmediately: true }
        );

        let cameraTimer: ReturnType<typeof setTimeout> | null = null;
        const offs = [
            disposeSync,
            offPress,
            camera.subscribe((state) => {
                if (cameraTimer) clearTimeout(cameraTimer);
                cameraTimer = setTimeout(
                    () =>
                        setUiState(cameraKey, {
                            x: state.x,
                            y: state.y,
                            zoom: state.zoom,
                        }),
                    250
                );
            }),
            scene.events.on('select', ({ shape }) => {
                const id = shape && !isGhostId(shape.id) ? shape.id : null;
                if (id !== store.selectedId) store.select(id);
            }),
            scene.events.on('change', ({ shape, kind, final }) => {
                if (kind !== 'move' || !(shape instanceof RectShape)) return;
                applyOffsets();
                if (!final) {
                    dragging = shape.id;
                    return;
                }
                dragging = null;
                store.setPosition(shape.id, { x: shape.x, y: shape.y });
            }),
            scene.events.on('action', ({ shape }) => {
                const data = (shape as Shape<TShapeData>).data;
                if (data?.kind === 'passage') store.openEditor(data.node.id);
                else if (data?.kind === 'ghost' && data.ghost.resolved) {
                    const chapterId = data.ghost.passageId.split('-')[0];
                    if (chapterId)
                        router.navigate({
                            page: 'chapter',
                            chapterId: chapterId as TChapterId,
                        });
                }
            }),
            scene.events.on('pointermove', ({ shape, screen }) => {
                const data = (shape as Shape<TShapeData> | null)?.data;
                const text =
                    data?.kind === 'passage'
                        ? `${data.node.id} · ${_('double-click to edit')}`
                        : data?.kind === 'ghost'
                          ? data.ghost.resolved
                              ? _(
                                    '%s (another chapter) · double-click to open',
                                    data.ghost.passageId
                                )
                              : _(
                                    '%s does not exist',
                                    data.ghost.passageId || '?'
                                )
                          : null;
                setTooltip(
                    text ? { text, x: screen.x + 14, y: screen.y + 14 } : null
                );
            }),
            scene.events.on('hover', ({ shape }) => {
                if (!shape) setTooltip(null);
            }),
        ];

        return () => {
            if (cameraTimer) clearTimeout(cameraTimer);
            setUiState(cameraKey, camera.state);
            offs.forEach((off) => off());
            selection.destroy();
            scene.destroy();
        };
    }, [store]);

    return (
        <SStage>
            <SCanvas ref={canvasRef} />
            {tooltip && (
                <STooltip style={{ left: tooltip.x, top: tooltip.y }}>
                    {tooltip.text}
                </STooltip>
            )}
        </SStage>
    );
};

const SStage = styled('div')`
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
`;

const SCanvas = styled('canvas')`
    display: block;
    width: 100%;
    height: 100%;
`;

const STooltip = styled('div')`
    position: absolute;
    pointer-events: none;
    max-width: 320px;
    padding: 4px 8px;
    border-radius: 4px;
    background: #333e;
    color: #eee;
    font-size: 12px;
`;
