import type { TPassageDto, TPassageEdgeDto, TPassageType } from '@story/visualizer-protocol';
import { displayText } from '../../../api';

/** A passage box of the chapter graph. */
export type TGraphNode = {
    id: string;
    characterId: string;
    type: TPassageType;
    title: string;
    /** The passage links to itself (drawn as a marker, not an arrow). */
    selfLoop: boolean;
};

/**
 * A link target that is not a passage of this chapter: a passage of another chapter (a
 * transition, `resolved`) or one that does not exist at all (a dangling id).
 */
export type TGhostNode = {
    id: string;
    passageId: string;
    resolved: boolean;
};

/** One arrow. Several links between the same two passages collapse into one edge with a `count`. */
export type TGraphEdge = {
    id: string;
    from: string;
    /** A passage id, or a ghost id (`ghost:<passageId>`). */
    to: string;
    kinds: TPassageEdgeDto['kind'][];
    /** Every link it stands for is conditional (inside code, or under a `condition`). */
    conditional: boolean;
    resolved: boolean;
    count: number;
};

export type TGraph = { nodes: TGraphNode[]; ghosts: TGhostNode[]; edges: TGraphEdge[] };

export const ghostId = (passageId: string) => `ghost:${passageId}`;
export const isGhostId = (id: string) => id.startsWith('ghost:');

export const passageTitle = (p: TPassageDto): string =>
    p.type === 'screen' ? displayText(p.title, p.localId) : p.localId;

/**
 * Nodes, ghost nodes and deduplicated arrows from `GET /api/chapters/:ch/passages` (the
 * server's static edge extraction, plan §1.1). Edges out of passages that are not in the list
 * are dropped.
 */
export const buildGraph = (passages: TPassageDto[], edges: TPassageEdgeDto[]): TGraph => {
    const ids = new Set(passages.map((p) => p.passageId));
    const selfLoops = new Set<string>();
    const ghosts = new Map<string, TGhostNode>();
    const merged = new Map<string, TGraphEdge>();

    for (const e of edges) {
        if (!ids.has(e.from)) continue;
        if (e.from === e.to) {
            selfLoops.add(e.from);
            continue;
        }
        let to = e.to;
        if (!ids.has(e.to)) {
            to = ghostId(e.to);
            const ghost = ghosts.get(to);
            ghosts.set(to, { id: to, passageId: e.to, resolved: (ghost?.resolved ?? false) || e.resolved });
        }
        const key = `${e.from}->${to}`;
        const prev = merged.get(key);
        if (prev) {
            if (!prev.kinds.includes(e.kind)) prev.kinds.push(e.kind);
            prev.conditional = prev.conditional && e.conditional;
            prev.resolved = prev.resolved || e.resolved;
            prev.count++;
        } else {
            merged.set(key, {
                id: key,
                from: e.from,
                to,
                kinds: [e.kind],
                conditional: e.conditional,
                resolved: e.resolved,
                count: 1,
            });
        }
    }

    const nodes = passages
        .map(
            (p): TGraphNode => ({
                id: p.passageId,
                characterId: p.characterId,
                type: p.type,
                title: passageTitle(p),
                selfLoop: selfLoops.has(p.passageId),
            })
        )
        .sort((a, b) => a.id.localeCompare(b.id));

    return { nodes, ghosts: [...ghosts.values()], edges: [...merged.values()] };
};
