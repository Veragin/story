import { BorderConfig } from "../Node/BorderConfig";
import { HorizontallyScalableNodeVisualObject } from "../Node/HorizontallyScalableNodeVisualObject";
import { nodeVisualObjectProperties } from "../Node/NodeVisualObject";
import { VisualObject } from "../Node/VisualObject";

export const selectableVisualProperties = {
    isSelected: 'isSelected',
    isMounted: 'isMounted',
    ...nodeVisualObjectProperties
};

export class PassageNodeVisualObject extends HorizontallyScalableNodeVisualObject {
    private _isSelected: boolean = false;

    get isSelected(): boolean {
        return this._isSelected;
    }

    set isSelected(selected: boolean) {
        this._isSelected = selected;
        this.redraw(true, selectableVisualProperties.isSelected);
    }

    private _isMounted: boolean = false;

    get isMounted(): boolean {
        return this._isMounted;
    }

    set isMounted(mounted: boolean) {
        this._isMounted = mounted;
        this.redraw(true, selectableVisualProperties.isMounted);
    }

    constructor(
        realPosition: TPoint,
        size: TSize,
        border: BorderConfig,
        content: VisualObject,
        backgroundColor: string = '#ffffff',
        zIndex: number = 0
    ) {
        super(realPosition, size, border, content, backgroundColor, zIndex);

        this.onHoverEnter.subscribe(() => {
            this.isSelected = true;
        });

        this.onHoverExit.subscribe(() => {
            this.isSelected = false;
        });

        this.onRightDown.subscribe(() => {
            this.isMounted = !this.isMounted;
        });

        this.onDragEnd.subscribe(() => {
            this.isMounted = true;
        });
    }

    override draw(ctx: CanvasRenderingContext2D): void {
        super.draw(ctx);
    }
}