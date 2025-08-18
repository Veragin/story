import { FreeDragStrategy } from "../../../Node/dragAndDropMovingStrategies/FreeDragStrategy";
import { TextContent, TTextAlignment } from "../../../Node/TextContent";
import { PassageNodeVisualObject } from "../../PassageNodeVisualObject";
import { ColorManager } from "../ColorManager";


type NodeTextConfig = {
    font: string;
    color: string;
    alignment: TTextAlignment;
}

type NodeDimensions = {
    width: number;
    height: number;
}


export abstract class AbstractPassageNodeCreator {
    protected static readonly MIN_NODE_WIDTH = 120;
    protected static readonly PADDING = 30;
    protected static readonly DEFAULT_FONT = '16px Roboto';

    constructor(
        protected readonly colorManager: ColorManager,
    ) {}

    protected createTextContent(
        text: string,
        position: { x: number; y: number },
        size: NodeDimensions,
        config: NodeTextConfig
    ): TextContent {
        return new TextContent({
            position,
            size,
            text,
            font: config.font,
            color: config.color,
            alignment: config.alignment
        });
    }

    protected calculateDimensions(text: string, font: string): NodeDimensions {
        const textWidth = this.getWidthOfString(text, font);
        const textHeight = this.getHeightOfString(font);

        return {
            width: Math.max(AbstractPassageNodeCreator.MIN_NODE_WIDTH, textWidth + AbstractPassageNodeCreator.PADDING),
            height: textHeight + AbstractPassageNodeCreator.PADDING
        };
    }

    protected getWidthOfString(text: string, font: string): number {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
            context.font = font;
            return context.measureText(text).width;
        }
        return 0;
    }

    protected getHeightOfString(font: string): number {
        const fontSize = parseInt(font, 10);
        return fontSize * 1.2;
    }

    protected setupNodeInteractions(node: PassageNodeVisualObject): void {
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
}