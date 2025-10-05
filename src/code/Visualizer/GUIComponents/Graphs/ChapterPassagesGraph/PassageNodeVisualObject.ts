import { BorderConfig } from "../../Canvas/Node/BorderConfig";
import { HorizontallyScalableNodeVisualObject } from "../../Canvas/Node/HorizontallyScalableNodeVisualObject";
import { nodeVisualObjectProperties } from "../NodeVisualObject";
import { VisualObject } from "../../Canvas/Node/VisualObject";
import { TRegisterPassageId } from "data/register";
import { IMementoAwareListener } from "../../MementoSystem/MementoAwareObserver";
import { DragEndChapter } from "../../Canvas/Node/DraggableVisualObject";

export const selectableVisualProperties = {
    isSelected: 'isSelected',
    isMounted: 'isMounted',
    ...nodeVisualObjectProperties
};

export class PassageNodeVisualObject extends HorizontallyScalableNodeVisualObject {
    private _isSelected: boolean = false;
    readonly passageId: TRegisterPassageId;

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
        passageId: TRegisterPassageId,
        realPosition: TPoint,
        size: TSize,
        border: BorderConfig,
        content: VisualObject,
        backgroundColor: string = '#ffffff',
        zIndex: number = 0
    ) {
        super(realPosition, size, border, content, backgroundColor, zIndex);
        this.passageId = passageId;

        this.onHoverEnter.subscribe(() => {
            this.isSelected = true;
        });

        this.onHoverExit.subscribe(() => {
            this.isSelected = false;
        });

        this.onRightDown.subscribe(() => {
            this.isMounted = false;
        });

        this.onDragEnd.subscribe(() => {
            this.isMounted = true;
        });
    }

    override draw(ctx: CanvasRenderingContext2D): void {
        super.draw(ctx);
    }
}

/**
 * Internal listener for hover enter events
 */
class MementoAwareHoverEnterListener implements IMementoAwareListener<PassageNodeVisualObject> {
    constructor(
        private node: MementoAwarePassageNodeVisualObject,
        public id: string
    ) {}

    getId(): string {
        return this.id;
    }

    onNotify(args: PassageNodeVisualObject): void {
        this.node.isSelected = true;
    }
}

/**
 * Internal listener for hover exit events
 */
class MementoAwareHoverExitListener implements IMementoAwareListener<PassageNodeVisualObject> {
    constructor(
        private node: MementoAwarePassageNodeVisualObject,
        public id: string
    ) {}

    getId(): string {
        return this.id;
    }

    onNotify(args: PassageNodeVisualObject): void {
        this.node.isSelected = false;
    }
}

/**
 * Internal listener for right down events
 */
class MementoAwareRightDownListener implements IMementoAwareListener<PassageNodeVisualObject> {
    constructor(
        private node: MementoAwarePassageNodeVisualObject,
        public id: string
    ) {}

    getId(): string {
        return this.id;
    }

    onNotify(args: PassageNodeVisualObject): void {
        this.node.isMounted = false;
    }
}

/**
 * Internal listener for drag end events
 */
class MementoAwareDragEndListener implements IMementoAwareListener<DragEndChapter> {
    constructor(
        private node: MementoAwarePassageNodeVisualObject,
        public id: string
    ) {}

    getId(): string {
        return this.id;
    }

    onNotify(args: DragEndChapter): void {
        this.node.isMounted = true;
    }
}

/**
 * MementoAware variant of PassageNodeVisualObject
 * Uses IMementoAwareListener pattern instead of regular listeners
 */
export class MementoAwarePassageNodeVisualObject extends PassageNodeVisualObject {
    // Store listener references so they can be persisted
    private hoverEnterListener?: MementoAwareHoverEnterListener;
    private hoverExitListener?: MementoAwareHoverExitListener;
    private rightDownListener?: MementoAwareRightDownListener;
    private dragEndListener?: MementoAwareDragEndListener;

    // Store the wrapper functions so we can unsubscribe later
    private hoverEnterWrapper?: (data: any) => void;
    private hoverExitWrapper?: (data: any) => void;
    private rightDownWrapper?: (data: any) => void;
    private dragEndWrapper?: (data: DragEndChapter) => void;

    constructor(
        passageId: TRegisterPassageId,
        realPosition: TPoint,
        size: TSize,
        border: BorderConfig,
        content: VisualObject,
        backgroundColor: string = '#ffffff',
        zIndex: number = 0
    ) {
        // Call parent constructor - but we need to prevent the parent from subscribing
        // We'll override the behavior by subscribing our own listeners after construction
        super(passageId, realPosition, size, border, content, backgroundColor, zIndex);

        // Unsubscribe the lambda functions that parent subscribed
        // (We can't directly access them, so we'll need to clear and re-subscribe)

        // Create listeners with unique IDs
        this.hoverEnterListener = new MementoAwareHoverEnterListener(
            this,
            `${this.getId()}_hoverEnterListener`
        );

        this.hoverExitListener = new MementoAwareHoverExitListener(
            this,
            `${this.getId()}_hoverExitListener`
        );

        this.rightDownListener = new MementoAwareRightDownListener(
            this,
            `${this.getId()}_rightDownListener`
        );

        this.dragEndListener = new MementoAwareDragEndListener(
            this,
            `${this.getId()}_dragEndListener`
        );

        // Create wrapper functions that bridge Observer and MementoAwareListener
        this.hoverEnterWrapper = (data: any) => this.hoverEnterListener!.onNotify(data as PassageNodeVisualObject);
        this.hoverExitWrapper = (data: any) => this.hoverExitListener!.onNotify(data as PassageNodeVisualObject);
        this.rightDownWrapper = (data: any) => this.rightDownListener!.onNotify(data as PassageNodeVisualObject);
        this.dragEndWrapper = (data: DragEndChapter) => this.dragEndListener!.onNotify(data);

        // Subscribe using the wrapper functions
        this.onHoverEnter.subscribe(this.hoverEnterWrapper);
        this.onHoverExit.subscribe(this.hoverExitWrapper);
        this.onRightDown.subscribe(this.rightDownWrapper);
        this.onDragEnd.subscribe(this.dragEndWrapper);
    }

    /**
     * Cleanup method to unsubscribe listeners when node is destroyed
     */
    dispose(): void {
        if (this.hoverEnterWrapper) {
            this.onHoverEnter.unsubscribe(this.hoverEnterWrapper);
        }

        if (this.hoverExitWrapper) {
            this.onHoverExit.unsubscribe(this.hoverExitWrapper);
        }

        if (this.rightDownWrapper) {
            this.onRightDown.unsubscribe(this.rightDownWrapper);
        }

        if (this.dragEndWrapper) {
            this.onDragEnd.unsubscribe(this.dragEndWrapper);
        }
    }
}