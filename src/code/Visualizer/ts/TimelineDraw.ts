import {
    MARK_BOTTOM_POSITION,
    MARK_TOP_POSITION,
    RESOLUTION_FACTOR,
    TEXT_Y_POSITION,
    TIMELINE_COLOR,
    TIMELINE_HEIGHT,
    TIMELINE_TOP_POSITION,
} from './constants';

export class TimelineDraw {
    private ctx: CanvasRenderingContext2D;

    constructor(public canvasRef: HTMLCanvasElement) {
        const ctx = this.canvasRef.getContext('2d');

        if (!ctx) {
            throw new Error("canvasRef.getContext('2d') is null");
        }
        this.ctx = ctx;
    }

    drawTimelineBorder = () => {
        this.ctx.clearRect(0, 0, this.canvasRef.width, this.canvasRef.height);
        this.ctx.fillStyle = TIMELINE_COLOR;
        this.ctx.fillRect(0, TIMELINE_TOP_POSITION, this.canvasRef.width, TIMELINE_HEIGHT);
    };

    drawTimelineLabel = (xPosition: number, label: string) => {
        this.ctx.strokeStyle = TIMELINE_COLOR;
        this.ctx.lineWidth = 2;

        this.ctx.beginPath();
        this.ctx.moveTo(xPosition, MARK_TOP_POSITION);
        this.ctx.lineTo(xPosition, MARK_BOTTOM_POSITION);
        this.ctx.closePath();
        this.ctx.stroke();

        const textWidht = this.ctx.measureText(label);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '14px Roboto';
        this.ctx.fillText(label, xPosition - textWidht.width / 2, TEXT_Y_POSITION);
    };

    rescale = () => {
        this.ctx.scale(RESOLUTION_FACTOR, RESOLUTION_FACTOR);
    };
}
