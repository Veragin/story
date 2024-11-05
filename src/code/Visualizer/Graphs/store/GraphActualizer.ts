import { Graph } from "../Graph";
import { register, TRegisterPassageId } from "data/register";
import { worldStateCopy } from "../PassagesGraph/WorldStateCopy";
import { PassageEdgeVisualObject } from "../PassagesGraph/PassageEdgeVisualObject";
import { NodeVisualObject } from "../Node/NodeVisualObject";
import { CanvasManager } from "../CanvasManager";
import { PassageNodeVisualObject } from "../PassagesGraph/PassageNodeVisualObject";
import { TextContent } from "../Node/TextContent";
import { FreeDragStrategy } from "../Node/dragAndDropMovingStrategies/FreeDragStrategy";
import { TLineType } from "../EdgeVisualObject";
import { TWorldState } from "data/TWorldState";
import { TPassage } from "types/TPassage";

export class GraphActualizer {
    private static readonly colorPalette = [
        '#f3e5f5', // Light purple
        '#e3f2fd', // Light blue
        '#e8f5e9', // Light green
        '#fff3e0', // Light orange
        '#fce4ec', // Light pink
        '#f1f8e9', // Light lime
        '#e0f7fa', // Light cyan
        '#fff8e1', // Light amber
    ];

    private static characterColors: Map<string, string> = new Map();

    /**
     * Verifies and updates the graph structure to match current passages
     */
    static async verifyGraphData(
        eventId: string, 
        graph: Graph, 
        canvasManager: CanvasManager,
        canvasWidth: number,
        canvasHeight: number
    ): Promise<Graph> {
        // Load passages from register
        const passagesModule = await register.passages[eventId as keyof typeof register.passages]();
        if (!passagesModule) {
            console.error(`No passages found for event ${eventId}`);
            return graph;
        }
        const currentPassages = passagesModule.default;

        // Initialize character colors
        this.initializeCharacterColors(currentPassages);

        // Track nodes and edges for updates
        const currentPassageIds = new Set(Object.keys(currentPassages));
        const existingNodes: Record<string, NodeVisualObject> = {};
        const nodesToRemove = new Set<string>();
        const passageIdsPresented = new Set<string>();

        // Analyze existing nodes
        for (const [nodeId, node] of Object.entries(graph.getAllNodes())) {
            const passageNode = node as PassageNodeVisualObject;
            
            if (passageIdsPresented.has(passageNode.passageId)) {
                nodesToRemove.add(nodeId);
                continue;
            }

            existingNodes[passageNode.passageId] = node;
            passageIdsPresented.add(passageNode.passageId);

            if (!currentPassageIds.has(passageNode.passageId)) {
                nodesToRemove.add(nodeId);
            }
        }

        // Remove obsolete nodes
        for (const nodeId of nodesToRemove) {
            graph.removeNode(nodeId);
        }

        // Add missing nodes
        for (const [passageId, passageData] of Object.entries(currentPassages)) {
            if (!passageIdsPresented.has(passageId)) {
                const passage = passageData(worldStateCopy);
                let node: NodeVisualObject | undefined;

                switch (passage.type) {
                    case 'screen':
                        node = await this.createScreenPassageNode(passageId as TRegisterPassageId, passage, canvasManager);
                        break;
                    case 'transition':
                        node = await this.createTransitionPassageNode(passageId as TRegisterPassageId, passage, canvasManager);
                        break;
                    case 'linear':
                        node = await this.createLinearPassageNode(passageId as TRegisterPassageId, passage, canvasManager);
                        break;
                }

                if (node) {
                    graph.addNode(node, passageId);
                    existingNodes[passageId] = node;
                }
            }
        }

        // Update edges
        await this.verifyEdges(graph, currentPassages, existingNodes);

        return graph;
    }

    private static async createScreenPassageNode(
        passageId: TRegisterPassageId, 
        passage: any,
        canvasManager: CanvasManager
    ): Promise<NodeVisualObject> {
        const characterId = passageId.split('-')[1];
        const backgroundColor = this.characterColors.get(characterId) || '#ffffff';
        const title = passage.title || passageId;

        const node = await this.createBaseNode(
            passageId,
            title,
            backgroundColor,
            {
                color: '#999999',
                width: 1,
                style: 'solid',
                radius: 8
            },
            canvasManager
        );

        this.setupNodeInteractions(node);
        return node;
    }

    private static async createTransitionPassageNode(
        passageId: TRegisterPassageId, 
        passage: any,
        canvasManager: CanvasManager
    ): Promise<NodeVisualObject> {
        const parts = passage.nextPassageId.split('-');
        const characterId = parts[1];
        let title = await this.getTransitionTitle(passageId, passage);
        const borderColor = title ? '#666666' : '#ff0000';
        
        if (!title) title = passage.id;
        
        const backgroundColor = this.characterColors.get(characterId) || '#ffffff';

        const node = await this.createBaseNode(
            passageId,
            title,
            backgroundColor,
            {
                color: borderColor,
                width: 1,
                style: 'dashed',
                radius: 8,
            },
            canvasManager,
            '#666666' // Text color
        );

        this.setupNodeInteractions(node);
        return node;
    }

    private static async createLinearPassageNode(
        passageId: TRegisterPassageId, 
        passage: any,
        canvasManager: CanvasManager
    ): Promise<NodeVisualObject> {
        const characterId = passageId.split('-')[1];
        const backgroundColor = this.characterColors.get(characterId) || '#ffffff';
        const title = passage.title || passageId;

        const node = await this.createBaseNode(
            passageId,
            title,
            backgroundColor,
            {
                color: '#999999',
                width: 1,
                style: 'solid',
                radius: 8
            },
            canvasManager
        );

        this.setupNodeInteractions(node);
        return node;
    }

    private static async createBaseNode(
        passageId: TRegisterPassageId,
        title: string,
        backgroundColor: string,
        border: any,
        canvasManager: CanvasManager,
        textColor: string = '#000000'
    ): Promise<PassageNodeVisualObject> {
        const MIN_NODE_WIDTH = 120;
        const PADDING = 30;
        const FONT = `16px Roboto`;

        const textWidth = this.getWidthOfString(title, FONT);
        const textHeight = this.getHeightOfString(FONT);

        const size = {
            width: Math.max(MIN_NODE_WIDTH, textWidth + PADDING),
            height: textHeight + PADDING
        };

        const position = { x: 0, y: 0 };

        const textContent = new TextContent({
            position,
            size,
            text: title,
            font: FONT,
            color: textColor,
            alignment: 'middle_center'
        });

        const node = new PassageNodeVisualObject(
            passageId,
            position,
            size,
            border,
            textContent,
            backgroundColor
        );

        canvasManager.addObject(textContent);
        return node;
    }

    // ... [Helper methods remain the same] ...
    private static getWidthOfString(text: string, font: string): number {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        return context ? context.measureText(text).width : 0;
    }

    private static getHeightOfString(font: string): number {
        const fontSize = parseInt(font, 10);
        return fontSize * 1.2;
    }

    private static setupNodeInteractions(node: PassageNodeVisualObject): void {
        node.setDragStrategy(new FreeDragStrategy());

        node.onHoverEnter.subscribe(() => {
            node.setBorder({
                ...node.getBorder(),
                color: '#000000',
                width: 2
            });
        });

        node.onHoverExit.subscribe(() => {
            node.setBorder({
                ...node.getBorder(),
                color: '#999999',
                width: 1
            });
        });
    }

    private static async getTransitionTitle(passageId: string, passage: any): Promise<string> {
        const parts = passage.nextPassageId.split('-');
        if (parts.length < 2) return passageId;

        const eventId = parts[0];
        const linkPassageModule = await register.passages[eventId as keyof typeof register.passages]();
        const linkPassages = linkPassageModule.default;
        let linkPassageData = linkPassages[passageId as keyof typeof linkPassages];

        if (typeof linkPassageData === 'function') {
            const [linkPassageId, linkPassageDataFunction] = Object.entries(linkPassages)[0];
            const linkPassage = linkPassageDataFunction({} as TWorldState);
            const linkEventId = linkPassageId.split('-')[0];
            const linkEvent = register.events[linkEventId as keyof typeof register.events];
            
            if (linkEvent) {
                return linkEvent.title + ' - ' + (linkPassage.title || linkPassageId);
            }
            return linkPassage.title || linkPassageId;
        }

        return '';
    }

    private static initializeCharacterColors(passages: Record<string, any>): void {
        const characterIds = new Set<string>();
        
        for (const passageId of Object.keys(passages)) {
            const parts = passageId.split('-');
            if (parts.length >= 2) {
                characterIds.add(parts[1]);
            }
        }

        Array.from(characterIds).forEach((characterId, index) => {
            const colorIndex = index % this.colorPalette.length;
            this.characterColors.set(characterId, this.colorPalette[colorIndex]);
        });
    }

    private static createPassageEdge(
        source: NodeVisualObject,
        target: NodeVisualObject,
        zIndex: number = 1,
        color: string = '#999999',
        style: TLineType = 'solid'
    ): PassageEdgeVisualObject {
        const edge = new PassageEdgeVisualObject(
            source,
            target,
            color,
            1,
            true,
            zIndex,
            style
        );

        edge.onTargetSelectedColor = 'black';
        edge.onSourceSelectedColor = '#1976d2';

        return edge;
    }

    private static async verifyEdges(
        graph: Graph, 
        passages: Record<string, any>, 
        nodes: Record<string, NodeVisualObject>
    ): Promise<void> {
        const existingEdges = new Map<string, PassageEdgeVisualObject>();
        let edgeCounter = 0;

        // Map existing edges
        for (const edge of graph.getAllEdges()) {
            if (!(edge instanceof PassageEdgeVisualObject)) continue;
            
            let sourceId = edge.getSource().getId();
            let targetId = edge.getTarget().getId();
            
            if (edge.getSource() instanceof PassageNodeVisualObject) {
                sourceId = (edge.getSource() as PassageNodeVisualObject).passageId;
            }
            if (edge.getTarget() instanceof PassageNodeVisualObject) {
                targetId = (edge.getTarget() as PassageNodeVisualObject).passageId;
            }
            
            existingEdges.set(`${sourceId}->${targetId}`, edge);
        }

        // Verify and create edges for each passage
        for (const [passageId, passageData] of Object.entries(passages)) {
            const sourceNode = graph.getNode(passageId);
            if (!sourceNode) continue;

            const passage = typeof passageData === 'function' ? passageData(worldStateCopy) : passageData;

            // Process edges based on passage type
            switch (passage.type) {
                case 'screen':
                    for (const section of passage.body) {
                        // Handle links
                        if (section.links) {
                            for (const link of section.links) {
                                const targetNode = graph.getNode(link.passageId);
                                if (!targetNode) continue;

                                const edgeKey = `${passageId}->${link.passageId}`;
                                if (!existingEdges.has(edgeKey)) {
                                    const edge = this.createPassageEdge(
                                        sourceNode,
                                        targetNode,
                                        1,
                                        '#999999',
                                        'solid'
                                    );
                                    graph.addEdge(edge, `edge-${edgeCounter++}`);
                                }
                                existingEdges.delete(edgeKey);
                            }
                        }

                        // Handle redirects
                        if (section.redirect) {
                            const targetNode = graph.getNode(section.redirect);
                            if (!targetNode) continue;

                            const edgeKey = `${passageId}->${section.redirect}`;
                            if (!existingEdges.has(edgeKey)) {
                                const edge = this.createPassageEdge(
                                    sourceNode,
                                    targetNode,
                                    0,
                                    '#ff0000',
                                    'solid'
                                );
                                graph.addEdge(edge, `edge-${edgeCounter++}`);
                            }
                            existingEdges.delete(edgeKey);
                        }
                    }
                    break;

                case 'linear':
                    if (passage.nextPassageId) {
                        const targetNode = graph.getNode(passage.nextPassageId);
                        if (!targetNode) continue;

                        const edgeKey = `${passageId}->${passage.nextPassageId}`;
                        if (!existingEdges.has(edgeKey)) {
                            const edge = this.createPassageEdge(
                                sourceNode,
                                targetNode,
                                0,
                                '#666666',
                                'solid'
                            );
                            graph.addEdge(edge, `edge-${edgeCounter++}`);
                        }
                        existingEdges.delete(edgeKey);
                    }
                    break;
            }
        }

        // Remove obsolete edges
        for (const [edgeKey, edge] of existingEdges) {
            for (const [id, graphEdge] of Object.entries(graph.getAllEdges())) {
                if (graphEdge === edge) {
                    graph.removeEdge(id);
                    break;
                }
            }
        }
    }
}