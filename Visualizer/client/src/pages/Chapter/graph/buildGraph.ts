import type { TPassageDto, TPassageEdgeDto, TPassageType } from '@story/visualizer-protocol';
import { displayText } from '../../../api';

export type TGraphNode = {
    id: string;
    characterId: string;
    type: TPassageType;
    title: string;
    selfLoop: boolean;
};

export type TGhostNode = {
    id: string;
    passageId: string;
    resolved: boolean;
};

export type TGraphEdge = {
    id: string;
    from: string;
    to: string;
    kinds: TPassageEdgeDto['kind'][];
    conditional: boolean;
    resolved: boolean;
    count: number;
};

export type TGraph = { nodes: TGraphNode[]; ghosts: TGhostNode[]; edges: TGraphEdge[] };

export const ghostId = (passageId: string) => `ghost:${passageId}`;
export const isGhostId = (id: string) => id.startsWith('ghost:');

const passageTitle = (p: TPassageDto): string => (p.type === 'screen' ? displayText(p.title, p.localId) : p.localId);

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
