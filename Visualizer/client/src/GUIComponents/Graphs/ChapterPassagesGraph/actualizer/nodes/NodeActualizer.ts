import { Graph } from '../../../Graph';
import { NodeVisualObject } from '../../../NodeVisualObject';
import { PassageNodeVisualObject } from '../../PassageNodeVisualObject';
import type { TGraphPassages } from '../graphPassage';
import { NodeFactory } from './NodeFactory';

interface NodeActualizationResult {
    existingNodes: Record<string, NodeVisualObject>;
    currentPassageIds: Set<string>;
}

export class NodeActualizer {
    constructor(private readonly nodeFactory: NodeFactory) {}

    actualizeNodes(graph: Graph, passages: TGraphPassages): NodeActualizationResult {
        const analysisResult = this.analyzeExistingNodes(graph, passages);
        this.removeObsoleteNodes(graph, analysisResult.nodesToRemove);
        this.addMissingNodes(graph, passages, analysisResult);

        return {
            existingNodes: analysisResult.existingNodes,
            currentPassageIds: analysisResult.currentPassageIds,
        };
    }

    private analyzeExistingNodes(
        graph: Graph,
        passages: TGraphPassages
    ): {
        existingNodes: Record<string, NodeVisualObject>;
        nodesToRemove: Set<string>;
        passageIdsPresented: Set<string>;
        currentPassageIds: Set<string>;
    } {
        const existingNodes: Record<string, NodeVisualObject> = {};
        const nodesToRemove = new Set<string>();
        const passageIdsPresented = new Set<string>();
        const currentPassageIds = new Set(Object.keys(passages));

        // Analyze existing nodes
        for (const node of Object.values(graph.getAllNodes())) {
            const passageNode = node as PassageNodeVisualObject;

            if (passageIdsPresented.has(passageNode.passageId) || !currentPassageIds.has(passageNode.passageId)) {
                nodesToRemove.add(passageNode.passageId);
                continue;
            }

            // Register existing node
            existingNodes[passageNode.passageId] = node;
            passageIdsPresented.add(passageNode.passageId);
        }

        return {
            existingNodes,
            nodesToRemove,
            passageIdsPresented,
            currentPassageIds,
        };
    }

    private removeObsoleteNodes(graph: Graph, nodesToRemove: Set<string>): void {
        for (const nodeId of nodesToRemove) {
            graph.removeNode(nodeId);
        }
    }

    private addMissingNodes(
        graph: Graph,
        passages: TGraphPassages,
        analysisResult: {
            existingNodes: Record<string, NodeVisualObject>;
            passageIdsPresented: Set<string>;
        }
    ): void {
        const { existingNodes, passageIdsPresented } = analysisResult;

        for (const [passageId, passage] of Object.entries(passages)) {
            if (passageIdsPresented.has(passageId)) continue;

            const node = this.nodeFactory.createNode(passage);
            if (node) {
                graph.addNode(node, passageId);
                existingNodes[passageId] = node;
            }
        }
    }
}
