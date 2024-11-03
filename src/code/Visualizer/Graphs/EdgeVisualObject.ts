import { NodeVisualObject } from './Node/NodeVisualObject';
import { ClickableVisualObject } from './Node/ClickableVisualObject';

export const edgeVisualObjectProperties = {
    source: 'source',
    target: 'target',
    color: 'color',
    width: 'width',
    arrow: 'arrow',
    zIndex: 'zIndex',
};

export type TLineType = 'solid' | 'dotted' | 'dashed';

export class EdgeVisualObject extends ClickableVisualObject {
    private _source: NodeVisualObject;
    private _target: NodeVisualObject;
    private _color: string;
    private _width: number;
    private _arrow: boolean;
    private _style: TLineType;

    constructor(
        source: NodeVisualObject,
        target: NodeVisualObject,
        color: string = '#000000',
        width: number = 1,
        arrow: boolean = true,
        zIndex: number = 0,
        style: TLineType = 'solid'
    ) {
        // Initialize with source position

        // should be always less than source and target
        if (zIndex >= source.zIndex) {
            zIndex = source.zIndex - 1;
        }
        if (zIndex >= target.zIndex) {
            zIndex = target.zIndex - 1;
        }

        super(source.getPosition(), { width: 0, height: 0 }, zIndex);

        this._source = source;
        this._target = target;
        this._color = color;
        this._width = width;
        this._arrow = arrow;
        this._style = style;


        // Subscribe to node position changes
        this._source.onPropertyChanged.subscribe(() => this.redraw(true, edgeVisualObjectProperties.source));
        this._target.onPropertyChanged.subscribe(() => this.redraw(true, edgeVisualObjectProperties.target));
    }

    private getPositionOfEndpointInSourceOrTargetNode(node: NodeVisualObject): TVec {
        return {
            x: node.getSize().width / 2,
            y: node.getSize().height / 2,
        };
    }

    override draw(ctx: CanvasRenderingContext2D): void {
        // Calculate source and target endpoint positions
        const sourceRealPos = this._source.getPosition();
        const sourceOffset = this.getPositionOfEndpointInSourceOrTargetNode(this._source);
        const sourcePos = {
            x: sourceRealPos.x + sourceOffset.x,
            y: sourceRealPos.y + sourceOffset.y,
        };

        const targetRealPos = this._target.getPosition();
        const targetOffset = this.getPositionOfEndpointInSourceOrTargetNode(this._target);
        const targetPos = {
            x: targetRealPos.x + targetOffset.x,
            y: targetRealPos.y + targetOffset.y,
        };

        // Draw line
        ctx.beginPath();
        ctx.strokeStyle = this._color;
        ctx.lineWidth = this._width;

        // Set line style
        switch (this._style) {
            case 'dashed':
                ctx.setLineDash([8, 4]);
                break;
            case 'dotted':
                ctx.setLineDash([2, 2]);
                break;
            case 'solid':
            default:
                ctx.setLineDash([]);
                break;
        }

        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw arrow if enabled
        if (this._arrow) {
            const angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x);
            const arrowLength = 10;
            //const arrowWidth = 8; // TODO

            ctx.beginPath();
            ctx.fillStyle = this._color;

            // Calculate arrow points, 2/3 of the way from source to target
            const arrowTip = {
                x: sourcePos.x + (2 / 3) * (targetPos.x - sourcePos.x),
                y: sourcePos.y + (2 / 3) * (targetPos.y - sourcePos.y),
            };

            ctx.moveTo(arrowTip.x, arrowTip.y);
            ctx.lineTo(
                arrowTip.x - arrowLength * Math.cos(angle - Math.PI / 6),
                arrowTip.y - arrowLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                arrowTip.x - arrowLength * Math.cos(angle + Math.PI / 6),
                arrowTip.y - arrowLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
        }
    }

    getSource(): NodeVisualObject {
        return this._source;
    }

    getTarget(): NodeVisualObject {
        return this._target;
    }

    setColor(color: string): void {
        const change = this._color !== color;
        this._color = color;
        this.redraw(change, edgeVisualObjectProperties.color);
    }

    setWidth(width: number): void {
        const change = this._width !== width;
        this._width = width;
        this.redraw(change, edgeVisualObjectProperties.width);
    }

    setArrow(arrow: boolean): void {
        const change = this._arrow !== arrow;
        this._arrow = arrow;
        this.redraw(change, edgeVisualObjectProperties.arrow);
    }

    override setZIndex(zIndex: number): void {
        // should be always less than source and target
        if (zIndex >= this._source.zIndex) {
            zIndex = this._source.zIndex - 1;
        }
        if (zIndex >= this._target.zIndex) {
            zIndex = this._target.zIndex - 1;
        }
        super.setZIndex(zIndex);
    }

    getColor(): string {
        return this._color;
    }

    getWidth(): number {
        return this._width;
    }

    hasArrow(): boolean {
        return this._arrow;
    }

    getStyle(): TLineType {
        return this._style;
    }
}
