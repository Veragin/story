import { assertNotNullish } from 'code/utils/typeguards';
import { EdgeFromSide } from 'code/Visualizer/Graphs/EdgeFromSide';
import { Graph } from 'code/Visualizer/Graphs/Graph';
import { HorizontalDragStrategy } from 'code/Visualizer/Graphs/Node/dragAndDropMovingStrategies/HorizontalDragStrategy';
import { HorizontallyScalableNodeVisualObject } from 'code/Visualizer/Graphs/Node/HorizontallyScalableNodeVisualObject';
import { TextContent } from 'code/Visualizer/Graphs/Node/TextContent';
import { TEvent } from 'types/TEvent';
import { TEventId } from 'types/TIds';

export const EVENT_NODE_HEIGHT = 60;

export class EventNodeBox<E extends TEventId> {
    private boxNode: HorizontallyScalableNodeVisualObject | null = null;
    private textNode: TextContent | null = null;

    constructor(public event: TEvent<E>) {}

    setupNodes = (graph: Graph, recompute: () => void, open: (id: TEventId) => void) => {
        const textContent = new TextContent({
            position: { x: 0, y: 0 },
            size: {
                width: 100,
                height: EVENT_NODE_HEIGHT,
            },
            text: this.event.title,
            alignment: 'middle_center',
        });

        const node = new HorizontallyScalableNodeVisualObject(
            { x: 0, y: 0 },
            { width: 100, height: EVENT_NODE_HEIGHT },
            {
                color: '#999999',
                width: 1,
                style: 'solid',
                radius: 6,
            },
            textContent,
            '#e3f2fd'
        );

        node.setDragStrategy(new HorizontalDragStrategy());

        // Add hover effects
        node.onHoverEnter.subscribe(() => {
            node.setBorder({
                ...node.getBorder(),
                color: '#000000',
                width: 2,
            });
        });

        node.onHoverExit.subscribe(() => {
            node.setBorder({
                ...node.getBorder(),
                color: '#999999',
                width: 1,
            });
        });

        node.onDragEnd.subscribe(recompute);
        node.onHorizontalResize.subscribe(recompute);

        // Add click handler
        node.onClick.subscribe(() => {
            open(this.event.eventId);
        });

        graph.addNode(node, this.event.eventId);
        graph.canvasManager.addObject(textContent);

        this.boxNode = node;
        this.textNode = textContent;
        return node;
    };

    setUpEdges = (graph: Graph) => {
        for (const e of this.event.children) {
            const childNode = graph.getNode(e.event.eventId);
            const edge = new EdgeFromSide(this.boxNode!, childNode!, '#ff0000');
            edge.id = `${this.event.eventId}-${e.event.eventId}`;
            graph.addEdge(edge, edge.id);
        }
    };

    update = (data: TUpdateData) => {
        assertNotNullish(this.boxNode);
        assertNotNullish(this.textNode);

        this.boxNode.setX(data.x);
        this.textNode.setX(data.x);
        this.boxNode.setW(data.width);
        this.textNode.setW(data.width);
        this.textNode.setText(data.title);
    };

    updateRow = (row: number, color: string) => {
        assertNotNullish(this.boxNode);
        assertNotNullish(this.textNode);

        this.boxNode.setY(row * EVENT_NODE_HEIGHT);
        this.textNode.setY(row * EVENT_NODE_HEIGHT);
        this.boxNode.setBackgroundColor(color);
    };

    get start() {
        return this.boxNode?.getPosition().x ?? 0;
    }

    get end() {
        return this.start + (this.boxNode?.getSize().width ?? 0);
    }

    destroyNodes = (graph: Graph) => {
        if (this.boxNode) {
            graph.removeNode(this.event.eventId);
        }
        if (this.textNode) {
            graph.canvasManager.removeObject(this.textNode);
        }
    };
}

type TUpdateData = {
    x: number;
    width: number;
    title: string;
};
