import { TextContent } from "./Node/TextContent";
import { CanvasManager } from "./CanvasManager";
import { HorizontallyScalableNodeVisualObject } from "./Node/HorizontallyScalableNodeVisualObject";
import { EdgeVisualObject } from "./EdgeVisualObject";
import { Graph } from "./Graph";
import { FreeDragStrategy } from "./Node/dragAndDropMovingStrategies/FreeDragStrategy";
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
                opts.canvasWidth / 1.5,
                opts.canvasHeight,
                Math.min(opts.canvasWidth, opts.canvasHeight) / 3
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
                const edge = new EdgeVisualObject(
                    sourceNode,
                    targetNode,
                    '#999999',
                    1,
                    true
                );
                
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

        const textContent = new TextContent(
            {
                x: position.x + opts.nodeWidth / 2 - this.getWidthOfString(label, 16) / 2,
                y: position.y + opts.nodeHeight / 2 - this.getHeightsOfString(label, 16) / 2
            },
            {
                width: this.getWidthOfString(label, 16),
                height: this.getHeightsOfString(label, 16)
            },
            label
        );

        const node = new HorizontallyScalableNodeVisualObject(
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

    private addNodeInteractions(node: HorizontallyScalableNodeVisualObject) {
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

    private getWidthOfString(str: string, fontSize: number): number {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }
        ctx.font = `${fontSize}px Arial`;
        return ctx.measureText(str).width;
    }

    private getHeightsOfString(str: string, fontSize: number): number {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }
        ctx.font = `${fontSize}px Arial`;
        return ctx.measureText(str).actualBoundingBoxAscent;
    }
}