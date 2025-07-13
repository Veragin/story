import { TRegisterPassageId } from "data/register";
import { Graph } from "../../../Graph";
import { NodeVisualObject } from "../../../Node/NodeVisualObject";
import { PassageNodeVisualObject } from "../../PassageNodeVisualObject";
import { worldStateCopy } from "../../WorldStateCopy";
import { NodeFactory } from "./NodeFactory";

interface NodeActualizationResult {
    existingNodes: Record<string, NodeVisualObject>;
    currentPassageIds: Set<string>;
}

export class NodeActualizer {
    constructor(
        private readonly nodeFactory: NodeFactory
    ) { }

    async actualizeNodes(
        graph: Graph,
        passages: Record<string, any>
    ): Promise<NodeActualizationResult> {
        const analysisResult = this.analyzeExistingNodes(graph, passages);
        await this.removeObsoleteNodes(graph, analysisResult.nodesToRemove);
        await this.addMissingNodes(graph, passages, analysisResult);

        return {
            existingNodes: analysisResult.existingNodes,
            currentPassageIds: analysisResult.currentPassageIds
        };
    }

    private analyzeExistingNodes(
        graph: Graph,
        passages: Record<string, any>
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
        for (const [nodeId, node] of Object.entries(graph.getAllNodes())) {
            const passageNode = node as PassageNodeVisualObject;

            if (passageIdsPresented.has(passageNode.passageId) ||
                !currentPassageIds.has(passageNode.passageId)) {
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
            currentPassageIds
        };
    }


    private async removeObsoleteNodes(
        graph: Graph,
        nodesToRemove: Set<string>
    ): Promise<void> {
        for (const nodeId of nodesToRemove) {
            graph.removeNode(nodeId);
        }
    }

    private async addMissingNodes(
        graph: Graph,
        passages: Record<string, any>,
        analysisResult: {
            existingNodes: Record<string, NodeVisualObject>;
            passageIdsPresented: Set<string>;
        }
    ): Promise<void> {
        const { existingNodes, passageIdsPresented } = analysisResult;

        for (const [passageId, passageData] of Object.entries(passages)) {
            if (passageIdsPresented.has(passageId))
                continue;

            const node = await this.createNode(passageId, passageData);
            if (node) {
                graph.addNode(node, passageId);
                existingNodes[passageId] = node;
            }
        }
    }

    private async createNode(
        passageId: string,
        passageData: any
    ): Promise<NodeVisualObject | undefined> {
        const passage = typeof passageData === 'function'
            ? passageData(worldStateCopy)
            : passageData;

        return this.nodeFactory.createNode(
            passageId as TRegisterPassageId,
            passage
        );
    }
}
