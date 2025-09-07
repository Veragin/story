import { CanvasPluginBase } from "./CanvasPluginBase";
import { MouseButton } from "../CanvasManager/InputConstants";
import { ClickableVisualObject } from "../Node/ClickableVisualObject";
import { VisualObject } from "../Node/VisualObject";
import { isPointInside } from "../Node/utils";

const isClickableObject = (obj: VisualObject): obj is ClickableVisualObject => {
    return 'handleClick' in obj && 'isClickable' in obj;
};

export class ClickingPlugin extends CanvasPluginBase {
    readonly name = "ClickingPlugin";

    protected onInitialize(): void {
        const core = this.canvasManagerCore;
        
        core.eventDispatcher.registerClick(
            "handle_click",
            (e, sp, wp) => this.handleMouseClick(e, sp, wp)
        );
        
        core.eventDispatcher.registerDblClick(
            "handle_dblclick",
            (e, sp, wp) => this.handleMouseDbClick(e, sp, wp)
        );
        
        core.eventDispatcher.registerMouseDown(
            "right_click",
            MouseButton.RIGHT,
            (e, sp, wp) => this.handleRightMouseDown(e, sp, wp)
        );
    }

    protected onDestroy(): void {
        // Event handlers are automatically cleaned up by the event dispatcher
        // when plugins are destroyed
    }

    protected onEnable(): void {
        // No specific enable logic needed
    }

    protected onDisable(): void {
        // No specific disable logic needed
    }

    private handleMouseClick = (
        event: MouseEvent, 
        screenPoint: TPoint, 
        worldPoint: TPoint): boolean => {

        const objectsAtPoint = this.getTopObjectsAtVisiblePoint(worldPoint);
        for (const obj of objectsAtPoint) {
            if (isClickableObject(obj)) {
                const stopPropagation = obj.handleClick(worldPoint);
                return stopPropagation;
            }
        }
        return false;
    };

    private handleMouseDbClick = (
        event: MouseEvent, 
        screenPoint: TPoint, 
        worldPoint: TPoint): boolean => {

        const objectsAtPoint = this.getTopObjectsAtVisiblePoint(worldPoint);
        for (const obj of objectsAtPoint) {
            if (isClickableObject(obj)) {
                const stopPropagation = obj.handleDbClick(worldPoint);
                return stopPropagation;
            }
        }
        return false;
    };

    private handleRightMouseDown(
        event: MouseEvent,
        screenPoint: TPoint,
        worldPoint: TPoint
    ): boolean {

        const objectsAtPoint = this.getTopObjectsAtVisiblePoint(worldPoint);
        for (const obj of objectsAtPoint) {
            if (isClickableObject(obj)) {
                const stopPropagation = obj.handleRightDown(worldPoint);
                return stopPropagation;
            }
        }
        
        return false;
    }

    private getTopObjectsAtVisiblePoint(worldPoint: TPoint): VisualObject[] {
        return this.canvasManagerCore.visibleVisualObjectsManager.getSortedVisibleObjects()
            .filter((obj: VisualObject) => isPointInside(worldPoint, obj.getPosition(), obj.getSize()))
            .reverse();
    }
}