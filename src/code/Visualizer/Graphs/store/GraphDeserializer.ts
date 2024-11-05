import { CanvasManager } from "../CanvasManager";
import { Graph } from "../Graph";
import { FreeDragStrategy } from "../Node/dragAndDropMovingStrategies/FreeDragStrategy";
import { NodeVisualObject } from "../Node/NodeVisualObject";
import { TextContent } from "../Node/TextContent";
import { PassageEdgeVisualObject } from "../PassagesGraph/PassageEdgeVisualObject";
import { PassageNodeVisualObject } from "../PassagesGraph/PassageNodeVisualObject";
import { GraphSerializer, SerializedGraph } from "./GraphSerializer";

export class GraphDeserializer {
    /**
     * Deserializes graph data and creates a new Graph instance
     */
    static deserialize(data: SerializedGraph, canvasManager: CanvasManager): Graph {
        const graph = new Graph(canvasManager);
        const nodeMap = new Map<string, NodeVisualObject>();

        // Create nodes
        for (const nodeData of data.nodes) {
            const textContent = new TextContent({
                position: nodeData.position,
                size: nodeData.size,
                text: nodeData.content.text,
                font: nodeData.content.font,
                color: nodeData.content.color,
                alignment: nodeData.content.alignment as any
            });

            const node = new PassageNodeVisualObject(
                nodeData.passageId,
                nodeData.position,
                nodeData.size,
                nodeData.borderConfig,
                textContent,
                nodeData.backgroundColor,
                nodeData.zIndex
            );
            node.isMounted = nodeData.isMounted;

            // Set up node interactions
            this.setupNodeInteractions(node);
            
            // Add to graph and store reference
            nodeMap.set(nodeData.id, node);
            graph.addNode(node, nodeData.passageId);
            canvasManager.addObject(textContent);
        }

        // Create edges
        for (const edgeData of data.edges) {
            const sourceNode = nodeMap.get(edgeData.sourceId);
            const targetNode = nodeMap.get(edgeData.targetId);

            if (!sourceNode || !targetNode) {
                console.error(`Could not find nodes for edge ${edgeData.id}`);
                continue;
            }

            const edge = new PassageEdgeVisualObject(
                sourceNode,
                targetNode,
                edgeData.color,
                edgeData.width,
                edgeData.arrow,
                edgeData.zIndex,
                edgeData.style
            );
            edge.onTargetSelectedColor = edgeData.onTargetSelectedColor;
            edge.onSourceSelectedColor = edgeData.onSourceSelectedColor;

            graph.addEdge(edge, edgeData.id);
        }

        return graph;
    }

    private static setupNodeInteractions(node: PassageNodeVisualObject): void {
        // Add drag behavior
        node.setDragStrategy(new FreeDragStrategy());

        // Add hover effects
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

    /**
     * Loads graph from localStorage and creates a new Graph instance
     */
    static loadFromLocalStorage(key: string, canvasManager: CanvasManager): Graph | null {
        const data = GraphSerializer.loadFromLocalStorage(key);
        return data ? this.deserialize(data, canvasManager) : null;
    }
}