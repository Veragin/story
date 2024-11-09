import { EdgeVisualObject } from './EdgeVisualObject';

export class EdgeFromSide extends EdgeVisualObject {
    id: string = '';

    override draw(ctx: CanvasRenderingContext2D): void {
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

        const { sourcePos, targetPos, arrowAngle } = this.computePositions();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.quadraticCurveTo(targetPos.x, sourcePos.y, targetPos.x, targetPos.y);
        ctx.stroke();
        ctx.setLineDash([]);

        this.drawArrow(ctx, sourcePos, targetPos, arrowAngle);
    }

    private computePositions = () => {
        const sPos = this._source.getPosition();
        const tPos = this._target.getPosition();
        const sSize = this._source.getSize();
        const tSize = this._target.getSize();

        const top =
            sPos.y < tPos.y
                ? sPos.y + sSize.height / 2 > tPos.y
                    ? 'middle'
                    : 'bottom'
                : tPos.y + tSize.height / 2 > sPos.y
                  ? 'middle'
                  : 'top';
        const left =
            sPos.x < tPos.x
                ? sPos.x + sSize.width / 2 > tPos.x
                    ? 'middle'
                    : 'right'
                : tPos.x + tSize.width / 2 > sPos.x
                  ? 'middle'
                  : 'left';

        return {
            sourcePos: {
                x: left === 'left' ? sPos.x : left === 'right' ? sPos.x + sSize.width : sPos.x + sSize.width / 2,
                y: left !== 'middle' ? sPos.y + sSize.height / 2 : top === 'top' ? sPos.y : sPos.y + sSize.height,
            },
            targetPos: {
                x: top !== 'middle' ? tPos.x + tSize.width / 2 : left === 'left' ? tPos.x + tSize.width : tPos.x,
                y: top === 'middle' ? tPos.y + tSize.height / 2 : top === 'top' ? tPos.y + tSize.height : tPos.y,
            },
            arrowAngle:
                top === 'top' ? (3 * Math.PI) / 2 : top === 'bottom' ? Math.PI / 2 : left === 'left' ? Math.PI : 0,
        };
    };

    protected drawArrow(ctx: CanvasRenderingContext2D, sourcePos: TPoint, targetPos: TPoint, angle: number = 0): void {
        if (this._arrow) {
            const arrowLength = 10;
            //const arrowWidth = 8; // TODO

            ctx.beginPath();
            ctx.fillStyle = this._color;

            ctx.moveTo(targetPos.x, targetPos.y);
            ctx.lineTo(
                targetPos.x - arrowLength * Math.cos(angle - Math.PI / 6),
                targetPos.y - arrowLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                targetPos.x - arrowLength * Math.cos(angle + Math.PI / 6),
                targetPos.y - arrowLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
        }
    }
}
