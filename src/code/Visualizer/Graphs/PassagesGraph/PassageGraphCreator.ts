import { CanvasManager } from "../CanvasManager";
import { Graph } from "../Graph";
import { GraphGenerator } from "../GraphGenerator";
import { SpringForceLayoutManager } from "../graphLayouts/SpringForceLayoutManager";
import { FreeDragStrategy } from "../Node/dragAndDropMovingStrategies/FreeDragStrategy";
import { TextContent } from "../Node/TextContent";
import { PassageEdgeVisualObject } from "./PassageEdgeVisualObject";
import { PassageNodeVisualObject } from "./PassageNodeVisualObject";
import { Title } from '../../../Components/Text';
import { TWorldState } from 'data/TWorldState';
import { s } from "worldState";
import { TPassage } from "types/TPassage";
import { NodeVisualObject } from "../Node/NodeVisualObject";

export class PassageGraphCreator {
    private readonly canvasManager: CanvasManager;
    private readonly canvasWidth: number;
    private readonly canvasHeight: number;
    private characterColors: Map<string, string> = new Map();

    // Pastel colors that work well for node backgrounds
    private readonly colorPalette = [
        '#f3e5f5', // Light purple
        '#e3f2fd', // Light blue
        '#e8f5e9', // Light green
        '#fff3e0', // Light orange
        '#fce4ec', // Light pink
        '#f1f8e9', // Light lime
        '#e0f7fa', // Light cyan
        '#fff8e1', // Light amber
    ];

    constructor(canvasManager: CanvasManager, canvasWidth: number, canvasHeight: number) {
        this.canvasManager = canvasManager;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
    }

    createGraph(passages: Record<string, any>): Graph {
        this.initializeCharacterColors(passages);

        const graph = new Graph(this.canvasManager);

        graph.setLayoutManager(new SpringForceLayoutManager(
            this.canvasWidth,
            this.canvasHeight
        ));

        // Create nodes for each passage
        for (const [passageId, passageData] of Object.entries(passages)) {
            const node = this.createNode(passageId, passageData);
            graph.addNode(node, passageId);
        }

        // Create edges based on passage links
        this.createEdges(graph, passages);

        // Apply layout
        graph.layout();

        return graph;
    }

    private initializeCharacterColors(passages: Record<string, any>): void {
        // Extract unique character IDs from passage IDs
        const characterIds = new Set<string>();

        for (const passageId of Object.keys(passages)) {
            const parts = passageId.split('-');
            if (parts.length >= 2) {
                characterIds.add(parts[1]);
            }
        }

        // Assign colors to characters
        Array.from(characterIds).forEach((characterId, index) => {
            const colorIndex = index % this.colorPalette.length;
            this.characterColors.set(characterId, this.colorPalette[colorIndex]);
        });
    }

    private createNode(passageId: string, passage: any): PassageNodeVisualObject {
        const characterId = passageId.split('-')[1];
        const backgroundColor = this.characterColors.get(characterId) || '#ffffff';

        // Constants for node sizing
        const MIN_NODE_WIDTH = 120;
        const PADDING = 30;
        const FONT_SIZE = 16;
        const FONT = `${FONT_SIZE}px Roboto`;

        const title = passage.title || passageId;

        // Calculate text dimensions
        const textWidth = PassageGraphCreator.getWidthOfString(title, FONT);
        const textHeight = PassageGraphCreator.getHeightsOfString(FONT);

        // Calculate node size with minimum width
        const size = {
            width: Math.max(MIN_NODE_WIDTH, textWidth + PADDING),
            height: textHeight + PADDING
        };

        // Start with position at origin
        const position = { x: 0, y: 0 };

        // Create text content with middle_center alignment
        const textContent = new TextContent({
            position: {
                x: position.x,
                y: position.y
            },
            size: size, 
            text: title,
            font: FONT,
            color: '#000000',
            alignment: 'middle_center'
        });

        // Create node
        const node = new PassageNodeVisualObject(
            position,
            size,
            {
                color: '#999999',
                width: 1,
                style: 'solid',
                radius: 8
            },
            textContent,
            backgroundColor
        );

        this.setupNodeInteractions(node);
        this.canvasManager.addObject(textContent);

        return node;
    }

    // Helper methods for text measurement
    static getWidthOfString(text: string, font: string): number {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) 
            return 0;

        context.font = font;
        const metrics = context.measureText(text);
        return metrics.width;
    }

    static getHeightsOfString(font: string): number {
        const fontSize = parseInt(font, 10);
        return fontSize * 1.2; // Approximate line height
    }


    private setupNodeInteractions(node: PassageNodeVisualObject): void {
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

    private createEdges(graph: Graph, passages: Record<string, any>): void {
        let edgeCounter = 0;
    
        for (const [passageId, passageData] of Object.entries(passages)) {
            const sourceNode = graph.getNode(passageId);
            if (!sourceNode) 
                continue;
    
            // Handle different passage types
            if (typeof passageData === 'function') {
                // For function-based passages, we need to get the actual passage object
                const passage = passageData({} as TWorldState);
                this.createEdgesForPassage(passage, sourceNode, graph, edgeCounter);
                continue;
            }
    
            this.createEdgesForPassage(passageData, sourceNode, graph, edgeCounter);
        }
    }
    
    private createEdgesForPassage(
        passage: TPassage<any, any, any>, 
        sourceNode: NodeVisualObject, 
        graph: Graph, 
        edgeCounter: number
    ): void {
        switch (passage.type) {
            case 'screen':
                // Handle screen type passages
                passage.body.forEach(section => {
                    if (section.links) {
                        section.links.forEach(link => {
                            const targetNode = graph.getNode(link.passageId);
                            if (!targetNode) return;
    
                            const edge = this.createPassageEdge(
                                sourceNode,
                                targetNode,
                                link.autoPriortiy || 1
                            );
    
                            graph.addEdge(edge, `edge-${edgeCounter++}`);
                        });
                    }
    
                    // Handle redirects
                    if (section.redirect) {
                        const targetNode = graph.getNode(section.redirect);
                        if (!targetNode) return;
    
                        const edge = this.createPassageEdge(
                            sourceNode,
                            targetNode,
                            0, // Lower priority for redirect edges
                            '#666666' // Different color for redirect edges
                        );
    
                        graph.addEdge(edge, `edge-${edgeCounter++}`);
                    }
                });
                break;
    
            case 'transition':
                // Handle transition type passages
                const targetNode = graph.getNode(passage.nextPassageId);
                if (!targetNode) return;
    
                const edge = this.createPassageEdge(
                    sourceNode,
                    targetNode,
                    0,
                    '#666666' // Different color for transition edges
                );
    
                graph.addEdge(edge, `edge-${edgeCounter++}`);
                break;
    
            case 'linear':
                // Handle linear type passages if nextPassageId exists
                if (passage.nextPassageId) {
                    const targetNode = graph.getNode(passage.nextPassageId);
                    if (!targetNode) return;
    
                    const edge = this.createPassageEdge(
                        sourceNode,
                        targetNode,
                        0,
                        '#666666' // Different color for linear edges
                    );
    
                    graph.addEdge(edge, `edge-${edgeCounter++}`);
                }
                break;
        }
    }
    
    private createPassageEdge(
        source: NodeVisualObject,
        target: NodeVisualObject,
        priority: number = 1,
        color: string = '#999999'
    ): PassageEdgeVisualObject {
        const edge = new PassageEdgeVisualObject(
            source,
            target,
            color,
            1,
            true
        );
    
        // Set colors for edge highlighting
        edge.onTargetSelectedColor = '#d32f2f';
        edge.onSourceSelectedColor = '#1976d2';
    
        // Adjust z-index based on priority
        edge.setZIndex(priority);
    
        return edge;
    }
}