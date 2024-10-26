import { TextContent } from "./Node/TextContent";
import { NodeVisualObject } from "./Node/NodeVisualObject";
import { CanvasManager } from "./CanvasManager";
import { DragStrategy } from "./Node/dragAndDropMovingStrategies/DragStrategy";
import { HorizontalDragStrategy } from "./Node/dragAndDropMovingStrategies/HorizontalDragStrategy";
import { GridDragStrategy } from "./Node/dragAndDropMovingStrategies/GridDragStrategy";

// Example data for nodes
interface NodeData {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    backgroundColor: string;
    dndMoveStrategy?: DragStrategy
}

const SAMPLE_NODES: NodeData[] = [
    {
        id: 'node1',
        x: 50,
        y: 50,
        width: 120,
        height: 60,
        label: 'Event 1',
        backgroundColor: '#e3f2fd',
        dndMoveStrategy: new HorizontalDragStrategy()
    },
    {
        id: 'node2',
        x: 250,
        y: 100,
        width: 120,
        height: 60,
        label: 'Event 2',
        backgroundColor: '#f3e5f5',
        dndMoveStrategy: new GridDragStrategy(150)
    },
    {
        id: 'node3',
        x: 150,
        y: 200,
        width: 120,
        height: 60,
        label: 'Event 3',
        backgroundColor: '#e8f5e9',

    }
];


export const getExampleNodes = (manager: CanvasManager) => SAMPLE_NODES.map(nodeData => {
    const textContent = new TextContent(
        countLabelStart(nodeData),
        {
            width: getWidthOfString(nodeData.label, 16),
            height: getHeightsOfString(nodeData.label, 16)
        },
        nodeData.label
    );

    const node = new NodeVisualObject(
        { x: nodeData.x, y: nodeData.y },
        { width: nodeData.width, height: nodeData.height },
        {
            color: '#999999',
            width: 1,
            style: 'solid',
            radius: 8
        },
        textContent,
        nodeData.backgroundColor
    );

    if(nodeData.dndMoveStrategy)
        node.setDragStrategy(nodeData.dndMoveStrategy);

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

    // Add click handler
    node.onClick.subscribe(() => {
        console.log(`Clicked node: ${nodeData.label}`);
    });

    manager.addObject(node);
    manager.addObject(textContent);
    return node;
});

const countLabelStart = (nodeData: NodeData) =>
({
    x: nodeData.x + nodeData.width / 2 - getWidthOfString(nodeData.label, 16) / 2,
    y: nodeData.y + nodeData.height / 2 - getHeightsOfString(nodeData.label, 16) / 2
});

const getWidthOfString = (str: string, fontSize: number) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get canvas context');
    }
    ctx.font = `${fontSize}px Arial`;
    return ctx.measureText(str).width;
}

const getHeightsOfString = (str: string, fontSize: number) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get canvas context');
    }
    ctx.font = `${fontSize}px Arial`;
    return ctx.measureText(str).actualBoundingBoxAscent;
}