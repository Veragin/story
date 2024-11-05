import { Graph } from "../Graph";
import { PassageGraphCreator } from "../PassagesGraph/PassageGraphCreator";
import { register, TRegisterPassageId } from "data/register";
import { worldStateCopy } from "../PassagesGraph/WorldStateCopy";
import { PassageEdgeVisualObject } from "../PassagesGraph/PassageEdgeVisualObject";
import { NodeVisualObject } from "../Node/NodeVisualObject";
import { CanvasManager } from "../CanvasManager";
import { PassageNodeVisualObject } from "../PassagesGraph/PassageNodeVisualObject";

export class GraphActualizer {
    /**
     * Verifies and updates the graph structure to match current passages
     */
    static async verifyGraphData(eventId: string, graph: Graph, canvasManager: CanvasManager): Promise<Graph> {
        // 1. Load current passages from register
        const passagesModule = await register.passages[eventId as keyof typeof register.passages]();
        if (!passagesModule) {
            console.error(`No passages found for event ${eventId}`);
            return graph;
        }
        const currentPassages = passagesModule.default;

        // Create sets for tracking what needs to be added/removed
        const currentPassageIds = new Set(Object.keys(currentPassages));
        const existingNodes: Record<string, NodeVisualObject> = {};
        const nodesToRemove = new Set<string>();
        const edgesToRemove = new Set<string>();

        // 2. Compare nodes with current passages
        const passageIdsPresented = new Set<string>();
        for (const [nodeId, node] of Object.entries(graph.getAllNodes())) {
            const passageNode = node as PassageNodeVisualObject;
            
            // If node for the same passage already exists, mark for removal
            if (passageIdsPresented.has(passageNode.passageId)) {
                nodesToRemove.add(nodeId);
                continue;
            }

            existingNodes[passageNode.passageId] = node;
            passageIdsPresented.add(passageNode.passageId);

            // If passage doesn't exist, mark node for removal
            if (!currentPassageIds.has(passageNode.passageId)) {
                nodesToRemove.add(nodeId);
            }
        }

        // 3. Find missing nodes that need to be added
        const nodesToAdd = new Array<string>();
        for (const passageId of currentPassageIds) {
            if (!passageIdsPresented.has(passageId)) {
                nodesToAdd.push(passageId);
            }
        }

        // 4. Process removals
        for (const nodeId of nodesToRemove) {
            graph.removeNode(nodeId);
        }

        // 5. Add missing nodes and their edges
        if (nodesToAdd.length > 0) {
            const creator = new PassageGraphCreator(
                canvasManager,
                canvasManager.getWidth() || 800,
                canvasManager.getHeight() || 600
            );

            // Add new nodes
            for (const [passageIdS, passageData] of Object.entries(currentPassages)) {
                const passageId = passageIdS as TRegisterPassageId;
                const passage = passageData(worldStateCopy);
                let node: NodeVisualObject | undefined;

                switch (passage.type) {
                    case 'screen':
                        node = await creator.createScreenPassageNode(passageId, passage);
                        break;
                    case 'transition':
                        node = await creator.createTransitionPassageNode(passageId, passage);
                        break;
                    case 'linear':
                        node = await creator.createLinearPassageNode(passageId, passage);
                        break;
                }

                if (node) {
                    graph.addNode(node, passageId);
                }
            }
        }

        // Verify and update edges
        await verifyEdges(graph, currentPassages, existingNodes);

        // 6. Update layout if changes were made
        if (nodesToAdd.length > 0 || nodesToRemove.size > 0) {
            graph.layout();
        }

        return graph;
    }
}

/**
 * Verifies and updates edges in the graph based on current passage structure
 */
async function verifyEdges(graph: Graph, passages: Record<string, any>, nodes: Record<string, NodeVisualObject>): Promise<void> { 
    const existingEdges = new Map<string, PassageEdgeVisualObject>();
    let edgeCounter = 0;

    // Create a map of existing edges for comparison
    for (const edge of graph.getAllEdges()) {
        if (!(edge instanceof PassageEdgeVisualObject)) {
            continue;
        }
        
        let sourceId = edge.getSource().getId();
        let targetId = edge.getTarget().getId();
        if(edge.getSource() instanceof PassageNodeVisualObject) {
            const sourceNode = edge.getSource() as PassageNodeVisualObject;
            sourceId = sourceNode.passageId;
        }
        if(edge.getTarget() instanceof PassageNodeVisualObject) {
            const targetNode = edge.getTarget() as PassageNodeVisualObject;
            targetId = targetNode.passageId;
        }
        const edgeKey = `${sourceId}->${targetId}`;
        existingEdges.set(edgeKey, edge);
    }

 
    


    // Check each passage for required edges
    for (const [passageId, passageData] of Object.entries(passages)) {
        const sourceNode = graph.getNode(passageId);
        if (!sourceNode) 
            continue;

        const passage = typeof passageData === 'function' ?
            passageData(worldStateCopy) :
            passageData;

        // Process edges based on passage type
        switch (passage.type) {
            case 'screen':
                // Handle screen type passages and their links
                for (const section of passage.body) {
                    // Process regular links
                    if (section.links) {
                        for (const link of section.links) {



                            // Check if the edge exists in the loaded graph
                            const targetNode = graph.getNode(link.passageId);
                            if(!sourceNode || !targetNode) 
                                throw Error('Node not found');

                            const edgeKey = `${passageId}->${link.passageId}`;
                            
                            if (!existingEdges.has(edgeKey)) {
                                // Add missing edge
                                const edge = new PassageEdgeVisualObject(
                                    sourceNode,
                                    targetNode,
                                    '#999999',
                                    1,
                                    true,
                                    1,
                                    'solid'
                                );
                                graph.addEdge(edge, `edge-${edgeCounter++}`);
                            }
                            existingEdges.delete(edgeKey); // Mark as processed
                        }
                    }

                    // Process redirects
                    if (section.redirect) {
                        const targetNode = graph.getNode(nodes[section.redirect].getId());
                        if (!targetNode) continue;

                        const edgeKey = `${passageId}->${section.redirect}`;
                        if (!existingEdges.has(edgeKey)) {
                            // Add missing redirect edge
                            const edge = new PassageEdgeVisualObject(
                                sourceNode,
                                targetNode,
                                '#ff0000',
                                1,
                                true,
                                0,
                                'solid'
                            );
                            graph.addEdge(edge, `edge-${edgeCounter++}`);
                        }
                        existingEdges.delete(edgeKey); // Mark as processed
                    }
                }
                break;

            case 'linear':
                // Handle linear passage connections
                if (passage.nextPassageId) {
                    const targetNode = graph.getNode(passage.nextPassageId);
                    if (!targetNode) continue;

                    const edgeKey = `${passageId}->${passage.nextPassageId}`;
                    if (!existingEdges.has(edgeKey)) {
                        // Add missing linear edge
                        const edge = new PassageEdgeVisualObject(
                            sourceNode,
                            targetNode,
                            '#666666',
                            1,
                            true,
                            0,
                            'solid'
                        );
                        graph.addEdge(edge, `edge-${edgeCounter++}`);
                    }
                    existingEdges.delete(edgeKey); // Mark as processed
                }
                break;

            case 'transition':
                // Transitions don't create edges
                break;
        }
    }

    // Remove any remaining edges that weren't found in current passages
    for (const [edgeKey, edge] of existingEdges) {
        for (const [id, graphEdge] of Object.entries(graph.getAllEdges())) {
            if (graphEdge === edge) {
                graph.removeEdge(id);
                break;
            }
        }
    }
}