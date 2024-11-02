import { TextContent } from "./Node/TextContent";
import { CanvasManager } from "./CanvasManager";
import { HorizontallyScalableNodeVisualObject } from "./Node/HorizontallyScalableNodeVisualObject";
import { Graph } from "./Graph";
import { FreeDragStrategy } from "./Node/dragAndDropMovingStrategies/FreeDragStrategy";
import { PassageEdgeVisualObject } from "./PassagesGraph/PassageEdgeVisualObject";
import { PassageNodeVisualObject } from "./PassagesGraph/PassageNodeVisualObject";
import { SpringForceLayoutManager } from "./graphLayouts/SpringForceLayoutManager";

type GraphGeneratorOptions = {
    nodeCount: number;
    edgeCount: number;
    canvasWidth?: number;
    canvasHeight?: number;
    gridSize?: number;
    nodeWidth?: number;
    nodeHeight?: number;
    layout?: 'grid' | 'circular' | 'random';
    colors?: string[];
}

export class GraphGenerator {
    private defaultColors = ['#e3f2fd', '#f3e5f5', '#e8f5e9', '#fff3e0', '#fce4ec'];
    private onTargetSelectedColor = '#d32f2f';
    private onSourceSelectedColor = '#1976d2';
    private defaultOptions: Required<GraphGeneratorOptions> = {
        nodeCount: 5,
        edgeCount: 6,
        canvasWidth: 800,
        canvasHeight: 600,
        gridSize: 150,
        nodeWidth: 120,
        nodeHeight: 60,
        layout: 'circular',
        colors: this.defaultColors
    };

    private graph: Graph;

    constructor(private canvasManager: CanvasManager) {
        this.graph = new Graph(canvasManager);
    }

    generate(options: GraphGeneratorOptions): Graph {
        const opts = { ...this.defaultOptions, ...options };

        // Clear existing graph
        this.graph.clear();

        // Set layout manager based on options
        if (opts.layout === 'circular') {
            this.graph.setLayoutManager(new SpringForceLayoutManager(
                opts.canvasWidth,
                opts.canvasHeight
            ));
        }

        // Generate nodes
        for (let i = 0; i < opts.nodeCount; i++) {
            const node = this.createNode(i, opts);
            this.graph.addNode(node, `node-${i}`);
        }

        // Generate random edges
        const generatedEdges = new Set<string>();
        let edgeCount = 0;
        const maxPossibleEdges = opts.nodeCount * (opts.nodeCount - 1);
        const targetEdgeCount = Math.min(opts.edgeCount, maxPossibleEdges);

        while (edgeCount < targetEdgeCount) {
            const sourceIndex = Math.floor(Math.random() * opts.nodeCount);
            let targetIndex = Math.floor(Math.random() * opts.nodeCount);

            // Avoid self-loops and duplicate edges
            while (targetIndex === sourceIndex ||
                generatedEdges.has(`${sourceIndex}-${targetIndex}`)) {
                targetIndex = Math.floor(Math.random() * opts.nodeCount);
                if (generatedEdges.size >= maxPossibleEdges) break;
            }

            if (generatedEdges.size >= maxPossibleEdges) break;

            generatedEdges.add(`${sourceIndex}-${targetIndex}`);

            const sourceNode = this.graph.getNode(`node-${sourceIndex}`);
            const targetNode = this.graph.getNode(`node-${targetIndex}`);

            if (sourceNode && targetNode) {
                const edge = new PassageEdgeVisualObject(
                    sourceNode,
                    targetNode,
                    '#999999',
                    1,
                    true
                );
                edge.onTargetSelectedColor = this.onTargetSelectedColor;
                edge.onSourceSelectedColor = this.onSourceSelectedColor;

                this.graph.addEdge(edge, `edge-${edgeCount}`);
                edgeCount++;
            }
        }

        // Apply layout
        this.graph.layout();

        return this.graph;
    }

    private createNode(index: number, opts: Required<GraphGeneratorOptions>): HorizontallyScalableNodeVisualObject {
        const label = `Node ${index + 1}`;
        const position = { x: 0, y: 0 }; // Initial position will be set by layout manager

        const textContent = new TextContent({
            position: {
                x: position.x + opts.nodeWidth / 2 - GraphGenerator.getWidthOfString(label, 16) / 2,
                y: position.y + opts.nodeHeight / 2 - GraphGenerator.getHeightsOfString(label, 16) / 2
            },
            size: {
                width: GraphGenerator.getWidthOfString(label, 16),
                height: GraphGenerator.getHeightsOfString(label, 16)
            },
            text: label
        });

        const node = new PassageNodeVisualObject(
            position,
            { width: opts.nodeWidth, height: opts.nodeHeight },
            {
                color: '#999999',
                width: 1,
                style: 'solid',
                radius: 8
            },
            textContent,
            opts.colors[index % opts.colors.length]
        );

        // Set drag strategy
        node.setDragStrategy(new FreeDragStrategy());

        // Add hover effects
        this.addNodeInteractions(node);

        this.canvasManager.addObject(textContent);
        return node;
    }

    private addNodeInteractions(node: PassageNodeVisualObject) {
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

        node.onClick.subscribe(() => {
            console.log(`Clicked node: ${(node.getContent() as TextContent).getText()}`);
        });
    }

    public static getWidthOfString(str: string, fontSize: number): number {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }
        ctx.font = `${fontSize}px Arial`;
        return ctx.measureText(str).width;
    }

    public static getHeightsOfString(str: string, fontSize: number): number {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }
        ctx.font = `${fontSize}px Arial`;
        return ctx.measureText(str).actualBoundingBoxAscent;
    }
}