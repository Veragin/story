import { CanvasManager } from "../CanvasManager";
import { Graph } from "../Graph";
import { SpringForceLayoutManager } from "../graphLayouts/SpringForceLayoutManager";
import { FreeDragStrategy } from "../Node/dragAndDropMovingStrategies/FreeDragStrategy";
import { TextContent } from "../Node/TextContent";
import { PassageEdgeVisualObject } from "./PassageEdgeVisualObject";
import { PassageNodeVisualObject } from "./PassageNodeVisualObject";
import { TWorldState } from 'data/TWorldState';
import { TPassage, TPassageTransition } from "types/TPassage";
import { NodeVisualObject } from "../Node/NodeVisualObject";
import { register } from "data/register";
import { worldStateCopy } from "./WorldStateCopy";
import { TLineType } from "../EdgeVisualObject";

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

    async createGraph(passages: Record<string, any>): Promise<Graph> {
        this.initializeCharacterColors(passages);
    
        const graph = new Graph(this.canvasManager);
        const readOnlyState = worldStateCopy.getReadOnlyState();
    
        graph.setLayoutManager(new SpringForceLayoutManager(
            this.canvasWidth,
            this.canvasHeight
        ));
    
        // Create nodes for each passage
        for (const [passageId, passageData] of Object.entries(passages)) {
            const passage = passageData(readOnlyState);
        
            let node: NodeVisualObject | undefined;
            switch (passage.type) {
                case 'screen':
                    node = await this.createScreenPassageNode(passageId, passage);
                    break;
                case 'transition':
                    node = await this.createTransitionPassageNode(passageId, passage);
                    break;
                case 'linear':
                    node = await this.createLinearPassageNode(passageId, passage);
                    break;
            }
            if (!node)
                continue;
        
            graph.addNode(node, passageId);
        }

        // Create edges based on passage links
        await this.createEdges(graph, passages);
    
        graph.layout();
    
        return graph;
    }
    
    async createScreenPassageNode(passageId: string, passage: any): Promise<NodeVisualObject> {
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

    async createTransitionPassageNode(passageId: string, passage: any): Promise<NodeVisualObject> {
        // get link and get passage of the link
        // show the title of link passage instead
        const parts = passage.nextPassageId.split('-');
        if (parts.length < 2) 
            throw new Error('Invalid passageId');

        const eventId = parts[0];
        const characterId = parts[1];

        // Try to get the title from the register
        let title: string = passageId;
        // Get the passage module
        const linkPassageModule = await register.passages[eventId as keyof typeof register.passages]();
        const linkPassages = linkPassageModule.default;

        // Get the passage data
        let linkPassageData = (linkPassages)[passageId as keyof typeof linkPassages];
        if (typeof linkPassageData === 'function') {
            const [linkPassageId, linkPassageDataFunction] = Object.entries(linkPassages)[0];
            const linkPassage = linkPassageDataFunction({} as TWorldState);
            const linkEventId = linkPassageId.split('-')[0];
            const linkEvent = register.events[linkEventId as keyof typeof register.events];
            if (linkEvent) {
                title = linkEvent.title + ' - ' + linkPassage.title || linkPassageId;
            } else {
                title = linkPassage.title || linkPassageId;
            }
        }

        let borderColor = '#666666';
        if(!title){
            title = passage.id;
            borderColor = '#ff0000';
        }
    
        const backgroundColor = this.characterColors.get(characterId) || '#ffffff';
        const minNodeWidth = 120;
        const padding = 30;
        const fontSize = 16;
        const font = `${fontSize}px Roboto`;

        const textWidth = PassageGraphCreator.getWidthOfString(title, font);
        const textHeight = PassageGraphCreator.getHeightsOfString(font);

        const size = {
            width: Math.max(minNodeWidth, textWidth + padding),
            height: textHeight + padding
        };

        const position = { x: 0, y: 0 };

        const textContent = new TextContent({
            position: {
                x: position.x,
                y: position.y
            },
            size: size,
            text: title,
            font: font,
            color: '#666666',
            alignment: 'middle_center'
        });

        const node = new PassageNodeVisualObject(
            position,
            size,
            {
                color: borderColor,
                width: 1,
                style: 'dashed',
                radius: 8,
            },
            textContent,
            backgroundColor
        );

        this.setupNodeInteractions(node);
        this.canvasManager.addObject(textContent);

        return node;
    }

    async createLinearPassageNode(passageId: string, passage: any): Promise<NodeVisualObject> {
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

    private async createEdges(graph: Graph, passages: Record<string, any>): Promise<void> {
        let edgeCounter = 0;
        const readOnlyState = worldStateCopy.getReadOnlyState();

        for (const [passageId, passageData] of Object.entries(passages)) {
            const sourceNode = graph.getNode(passageId);
            if (!sourceNode)
                continue;

            // Handle different passage types
            if (typeof passageData === 'function') {
                const passage = passageData(readOnlyState);
                edgeCounter = await this.createEdgesForPassage(passage, sourceNode, graph, edgeCounter);
                continue;
            }

            this.createEdgesForPassage(passageData, sourceNode, graph, edgeCounter);
        }
    }

    private async createEdgesForPassage(
        passage: TPassage<any, any, any>,
        sourceNode: NodeVisualObject,
        graph: Graph,
        edgeCounter: number
    ): Promise<number> {
        switch (passage.type) {
            case 'screen':
                // Handle screen type passages
                passage.body.forEach(section => {
                    if (section.links) {
                        section.links.forEach(link => {
                            const targetNode = graph.getNode(link.passageId);
                            if (!targetNode) 
                                return;

                            // if target node is Transition, set style to dashed
                            const style = targetNode instanceof PassageNodeVisualObject ? 'solid' : 'dashed';

                            const zIndex = 1;
                            const edge = this.createPassageEdge(
                                sourceNode,
                                targetNode,
                                zIndex,
                                '#999999',
                                style
                            );

                            graph.addEdge(edge, `edge-${edgeCounter++}`);
                        });
                    }

                    // Handle redirects
                    if (section.redirect) {
                        const targetNode = graph.getNode(section.redirect);
                        if (!targetNode) return;

                        const zIndex = 0;
                        const edge = this.createPassageEdge(
                            sourceNode,
                            targetNode,
                            zIndex,
                            '#ff0000'
                        );

                        graph.addEdge(edge, `edge-${edgeCounter++}`);
                    }
                });
                break;

            case 'transition':
                // do nothing
                break;
            case 'linear':
                if (passage.nextPassageId) {
                    const targetNode = graph.getNode(passage.nextPassageId);
                    if (!targetNode)
                        return edgeCounter;

                    const edge = this.createPassageEdge(
                        sourceNode,
                        targetNode,
                        0,
                        '#666666',
                    );

                    graph.addEdge(edge, `edge-${edgeCounter++}`);
                }
                break;
        }
        return edgeCounter;
    }

    private createPassageEdge(
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

        // Set colors for edge highlighting
        edge.onTargetSelectedColor = 'black';
        edge.onSourceSelectedColor = '#1976d2';

        return edge;
    }
}