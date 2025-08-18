import { TRegisterPassageId } from "data/register";
import { TLineType } from "../../EdgeVisualObject";
import { Graph } from "../../Graph";
import { BorderConfig } from "../../Node/BorderConfig";
import { NodeVisualObject } from "../../Node/NodeVisualObject";
import { TextContent } from "../../Node/TextContent";
import { PassageNodeVisualObject } from "../PassageNodeVisualObject";
import { PassageEdgeVisualObject } from "../PassageEdgeVisualObject";

export type SerializedNode = {
    id: string;
    passageId: TRegisterPassageId;
    position: TPoint;
    size: TSize;
    backgroundColor: string;
    borderConfig: BorderConfig;
    content: {
        text: string;
        font?: string;
        color?: string;
        alignment?: string;
    };
    zIndex: number;
    isMounted: boolean;
}

export type SerializedEdge = {
    id: string;
    sourceId: string;
    targetId: string;
    color: string;
    width: number;
    arrow: boolean;
    zIndex: number;
    style: TLineType;
    onTargetSelectedColor: string;
    onSourceSelectedColor: string;
    defaultColor: string;
}

export type SerializedGraph = {
    nodes: SerializedNode[];
    edges: SerializedEdge[];
}

export class GraphSerializer {
    /**
     * Serializes a Graph instance into a JSON-friendly format
     */
    static serialize(graph: Graph): SerializedGraph {
        const nodes: SerializedNode[] = [];
        const edges: SerializedEdge[] = [];

        // Serialize nodes
        for (const [id, visNode] of Object.entries(graph.getAllNodes())) {
            if (!(visNode instanceof PassageNodeVisualObject)) 
                throw new Error('Not Implemented Exception');
            
            const node = visNode as PassageNodeVisualObject;
            const content = node.getContent() as TextContent;
            
            nodes.push({
                id,
                passageId: node.passageId,
                position: node.getPosition(),
                size: node.getSize(),
                backgroundColor: node.getBackgroundColor(),
                borderConfig: node.getBorder(),
                content: {
                    text: content.getText(),
                    font: content.getFont(),
                    color: content.getColor(),
                    alignment: content.getAlignment()
                },
                zIndex: node.zIndex,
                isMounted: (node as PassageNodeVisualObject).isMounted,
            });
        }

        // Serialize edges
        for (const [id, edgeS] of Object.entries(graph.getAllEdges())) {
            const edge = edgeS as PassageEdgeVisualObject;
            edges.push({
                id,
                sourceId: this.findNodeId(graph, edge.getSource()),
                targetId: this.findNodeId(graph, edge.getTarget()),
                color: edge.getColor(),
                width: edge.getWidth(),
                arrow: edge.hasArrow(),
                style: edge.getStyle(),
                zIndex: edge.zIndex,
                onTargetSelectedColor: edge.onTargetSelectedColor,
                onSourceSelectedColor: edge.onSourceSelectedColor,
                defaultColor: edge.defaultColor
            });
        }

        return { nodes, edges };
    }

    private static findNodeId(graph: Graph, node: NodeVisualObject): string {
        for (const [id, n] of Object.entries(graph.getAllNodes())) {
            if (n === node) return id;
        }
        throw new Error('Node not found in graph');
    }

    /**
     * Saves the graph data to localStorage
     */
    static saveToLocalStorage(graph: Graph, key: string): void {
        const serializedData = this.serialize(graph);
        localStorage.setItem(key, JSON.stringify(serializedData));
    }

    /**
     * Retrieves saved graph data from localStorage
     */
    static loadFromLocalStorage(key: string): SerializedGraph | null {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }
}
