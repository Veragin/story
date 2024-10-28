import { assertNotNullish } from 'code/utils/typeguards';
import { CanvasManager } from 'code/Visualizer/Graphs/CanvasManager';
import { HorizontalDragStrategy } from 'code/Visualizer/Graphs/Node/dragAndDropMovingStrategies/HorizontalDragStrategy';
import { HorizontallyScalableNodeVisualObject } from 'code/Visualizer/Graphs/Node/HorizontallyScalableNodeVisualObject';
import { TextContent } from 'code/Visualizer/Graphs/Node/TextContent';
import { TEvent } from 'types/TEvent';
import { TEventId } from 'types/TIds';

export const EVENT_NODE_HEIGHT = 60;

export class EventNodeBox<E extends TEventId> {
    private boxNode: HorizontallyScalableNodeVisualObject | null = null;
    private textContent: TextContent | null = null;

    constructor(public event: TEvent<E>) {}

    setupNodes = (manager: CanvasManager) => {
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

        // Add click handler
        node.onClick.subscribe(() => {
            console.log(`Clicked node: ${this.event.title}`);
        });

        manager.addObject(node);
        manager.addObject(textContent);

        this.boxNode = node;
        this.textContent = textContent;
        return node;
    };

    update = (data: TUpdateData) => {
        assertNotNullish(this.boxNode);
        assertNotNullish(this.textContent);

        this.boxNode.setPosition({ x: data.x, y: data.y });
        this.boxNode.setSize({ width: data.width, height: data.height });
        this.textContent.setPosition({ x: data.x, y: data.y });
        this.textContent.setSize({ width: data.width, height: data.height });
        this.textContent.setText(data.title);
    };

    destroyNodes = (manager: CanvasManager) => {
        if (this.boxNode) {
            manager.removeObject(this.boxNode);
        }
        if (this.textContent) {
            manager.removeObject(this.textContent);
        }
    };
}

type TUpdateData = {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
};
