import { CanvasPluginBase } from "./CanvasPluginBase";
import { TPoint } from "./CanvasWorld";
import { MouseButton } from "./InputConstants";
import { DraggableVisualObject } from "../Node/DraggableVisualObject";
import { VisualObject } from "../Node/VisualObject";
import { isPointInside } from "../Node/utils";

const isDraggableObject = (obj: any): obj is DraggableVisualObject => {
    return 'isDragging' in obj && 'isDraggable' in obj;
};

export class DraggingPlugin extends CanvasPluginBase {
    readonly name = "DraggingPlugin";
    private draggedObject: DraggableVisualObject | null = null;

    protected onInitialize(): void {
        const canvasManagerCore = this.canvasManagerCore;
        canvasManagerCore.eventDispatcher.registerMouseDown(
            "start_drag",
            MouseButton.LEFT,
            (e, sp, wp) => this.handleMouseDown(e, sp, wp)
        );
        canvasManagerCore.eventDispatcher.registerMouseMove(
            "drag",
            (e, sp) => this.handleMouseMove(e, sp)
        );
        canvasManagerCore.eventDispatcher.registerMouseUp(
            "end_drag",
            MouseButton.LEFT,
            (e, sp, wp) => this.handleMouseUp(e, sp, wp)
        );
    }

    protected onDestroy(): void {
    }

    protected onEnable(): void {
    }

    protected onDisable(): void {
        if (this.draggedObject) {
            this.draggedObject.endDrag({ x: 0, y: 0 });
            this.draggedObject = null;
        }
    }

    private handleMouseDown(
        event: MouseEvent,
        screenPoint: TPoint,
        worldPoint: TPoint): boolean {

        const objectsAtPoint = this.getTopObjectsAtVisiblePoint(worldPoint);
        const draggableObject = objectsAtPoint.find((obj) =>
            isDraggableObject(obj) && obj.isDraggable()
        ) as DraggableVisualObject | undefined;
        if (draggableObject) {
            this.draggedObject = draggableObject;
            draggableObject.startDrag(worldPoint);
            this.bringToFront(draggableObject);
            return true;
        }
        return false;
    }

    private handleMouseMove(event: MouseEvent, screenPoint: TPoint): boolean {
        if (!this.draggedObject) return false;
        const worldPoint = this.canvasManagerCore.canvasWorld.screenToWorld(screenPoint);
        this.draggedObject.drag(worldPoint);
        return true;
    }

    private handleMouseUp(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        if (!this.draggedObject) return false;
        this.draggedObject.endDrag(worldPoint);
        this.draggedObject = null;
        return true;
    }

    private getTopObjectsAtVisiblePoint(worldPoint: TPoint): VisualObject[] {
        return this.canvasManagerCore.visibleVisualObjectsManager.getSortedVisibleObjects()
            .filter((obj: VisualObject) => isPointInside(worldPoint, obj.getPosition(), obj.getSize()))
            .reverse();
    }

    private bringToFront(obj: VisualObject): void {
        const allObjects = Array.from(this.canvasManagerCore.allObjects as Iterable<VisualObject>);
        const highestZIndex = Math.max(...allObjects.map(o => o.zIndex));
        obj.setZIndex(highestZIndex + 1);
    }
}