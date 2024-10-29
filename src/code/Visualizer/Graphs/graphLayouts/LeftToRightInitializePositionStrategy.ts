import { EdgeVisualObject } from "../EdgeVisualObject";
import { NodeVisualObject } from "../Node/NodeVisualObject";
import { InitializePositionStrategy } from "./KamadaKawaiLayoutManager";

/**
 * Initializes node positions in a left-to-right manner.
 * Finds strong connection components and places them from left to right.
 * when next component has just one target node of some edge, it will be placed next to
 * the component of the source nodes component.
 */

export class LeftToRightInitializePositionStrategy implements InitializePositionStrategy {
    private edges: EdgeVisualObject[] = [];
    private nodeMap: Map<string, NodeVisualObject> = new Map();
    private visitedNodes: Set<NodeVisualObject> = new Set();
    private stack: NodeVisualObject[] = [];
    private sccList: Set<NodeVisualObject>[] = [];

    private nodesNeighbors: Map<NodeVisualObject, NodeVisualObject[]> = new Map();

    private nodeIndex: Map<NodeVisualObject, number> = new Map();
    private lowLink: Map<NodeVisualObject, number> = new Map();
    private index: number = 0;

    // Layout configuration
    private readonly HORIZONTAL_GAP = 300; // Gap between SCCs
    private readonly VERTICAL_GAP = 200; // Gap between SCCs vertically
    private readonly SCC_RADIUS = 100; // Radius for circular layout within SCCs

    initializePositions(
        nodes: NodeVisualObject[],
        edges: EdgeVisualObject[],
        width: number,
        height: number): void {
        this.edges = edges;

        // Get neighbors for each node
        this.nodesNeighbors = this.findNeighbors(nodes, edges);

        // Create a map of node IDs to nodes for easier lookup
        nodes.forEach(node => {
            const nodeId = node.getId();
            this.nodeMap.set(nodeId, node);
        });

        // Find all strongly connected components
        const sccs = this.findStronglyConnectedComponents(nodes);
        const sccsEdges = this.findEdgesBetweenSCCs(sccs);

        // get tree layout for sccs from left to right
        // Create a tree layout for SCCs
        this.layoutSCCs(sccs, sccsEdges, width, height);
    }

    findEdgesBetweenSCCs(sccs: Set<NodeVisualObject>[]) {
        const sccsEdges = new Map<Set<NodeVisualObject>, Set<EdgeVisualObject>>();
        sccs.forEach(scc => sccsEdges.set(scc, new Set<EdgeVisualObject>()));
        this.edges.forEach(edge => {
            const source = edge.getSource();
            const target = edge.getTarget();
            const sourceScc = sccs.find(scc => scc.has(source));
            const targetScc = sccs.find(scc => scc.has(target));
            if (sourceScc !== targetScc) {
                sccsEdges.get(sourceScc!)!.add(edge);
            }
        });
        return sccsEdges;
    }

    // Tarjan's algorithm for finding SCCs
    private findStronglyConnectedComponents(nodes: NodeVisualObject[]): Set<NodeVisualObject>[] {
        nodes.forEach(node => {
            if (!this.nodeIndex.has(node)) {
                this.strongConnect(node);
            }
        });
        return this.sccList;
    }

    private strongConnect(node: NodeVisualObject): void {
        this.nodeIndex.set(node, this.index);
        this.lowLink.set(node, this.index);
        this.index += 1;
        this.stack.push(node);
        this.visitedNodes.add(node);

        const neighbors = this.nodesNeighbors.get(node)!;

        neighbors.forEach(neighborId => {
            if (!this.nodeIndex.has(neighborId)) {
                this.strongConnect(neighborId);
                this.lowLink.set(node,
                    Math.min(this.lowLink.get(node)!, this.lowLink.get(neighborId)!));
            } else if (this.visitedNodes.has(neighborId)) {
                this.lowLink.set(node,
                    Math.min(this.lowLink.get(node)!, this.nodeIndex.get(neighborId)!));
            }
        });

        if (this.lowLink.get(node) === this.nodeIndex.get(node)) {
            const scc = new Set<NodeVisualObject>();
            let w: NodeVisualObject;
            do {
                w = this.stack.pop()!;
                this.visitedNodes.delete(w);
                scc.add(w);
            } while (w !== node);
            this.sccList.push(scc);
        }
    }

    private positionSCCCircularly(nodes: NodeVisualObject[], centerX: number, centerY: number, radius: number): void {
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            node.setRealPosition({ x, y });
        });
    }

    private findNeighbors(nodes: NodeVisualObject[], edges: EdgeVisualObject[]): Map<NodeVisualObject, NodeVisualObject[]> {
        const neighbors = new Map<NodeVisualObject, NodeVisualObject[]>();
        nodes.forEach(node => neighbors.set(node, []));

        edges.forEach(edge => {
            const source = edge.getSource();
            const target = edge.getTarget();
            neighbors.get(source)!.push(target);
        });

        return neighbors;
    }





    private layoutSCCs(
        sccs: Set<NodeVisualObject>[],
        sccsEdges: Map<Set<NodeVisualObject>, Set<EdgeVisualObject>>,
        width: number,
        height: number
    ): void {
        // Find root SCCs (those with no incoming edges)
        const incomingEdges = new Map<Set<NodeVisualObject>, number>();
        sccs.forEach(scc => incomingEdges.set(scc, 0));

        sccsEdges.forEach((edges, sourceScc) => {
            edges.forEach(edge => {
                const targetScc = sccs.find(scc => scc.has(edge.getTarget()))!;
                incomingEdges.set(targetScc, (incomingEdges.get(targetScc) || 0) + 1);
            });
        });

        const rootSccs = sccs.filter(scc => incomingEdges.get(scc) === 0);

        // Calculate positions for each SCC using a modified level-based layout
        const sccLevels = this.assignSCCLevels(sccs, sccsEdges, rootSccs);
        const maxLevel = Math.max(...Array.from(sccLevels.values()));

        // Position SCCs by levels
        const levelGroups = new Map<number, Set<NodeVisualObject>[]>();
        sccLevels.forEach((level, scc) => {
            if (!levelGroups.has(level)) {
                levelGroups.set(level, []);
            }
            levelGroups.get(level)!.push(scc);
        });

        // Calculate the starting X position to center the layout
        const startX = width * 0.1;
        const startY = height * 0.1;

        // Position each SCC and its nodes
        levelGroups.forEach((sccsInLevel, level) => {
            const levelX = startX + level * this.HORIZONTAL_GAP;

            sccsInLevel.forEach((scc, indexInLevel) => {
                const levelY = startY + indexInLevel * this.VERTICAL_GAP;

                // Position the SCC's nodes in a circle
                const sccNodes = Array.from(scc);
                this.positionSCCCircularly(
                    sccNodes,
                    levelX,
                    levelY,
                    Math.min(this.SCC_RADIUS, this.calculateOptimalRadius(sccNodes.length))
                );
            });
        });
    }

    private assignSCCLevels(
        sccs: Set<NodeVisualObject>[],
        sccsEdges: Map<Set<NodeVisualObject>, Set<EdgeVisualObject>>,
        rootSccs: Set<NodeVisualObject>[]
    ): Map<Set<NodeVisualObject>, number> {
        const levels = new Map<Set<NodeVisualObject>, number>();
        const visited = new Set<Set<NodeVisualObject>>();

        // Helper function for DFS
        const assignLevel = (scc: Set<NodeVisualObject>, level: number) => {
            if (visited.has(scc)) {
                return;
            }

            visited.add(scc);
            levels.set(scc, Math.max(level, levels.get(scc) || 0));

            // Find all target SCCs
            const edges = sccsEdges.get(scc) || new Set<EdgeVisualObject>();
            edges.forEach(edge => {
                const targetScc = sccs.find(s => s.has(edge.getTarget()))!;
                assignLevel(targetScc, level + 1);
            });
        };

        // Start from each root SCC
        rootSccs.forEach(scc => assignLevel(scc, 0));

        return levels;
    }

    private calculateOptimalRadius(nodeCount: number): number {
        // Calculate optimal radius based on node count to prevent overcrowding
        return Math.max(30, Math.min(this.SCC_RADIUS, nodeCount * 20));
    }
}
