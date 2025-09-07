import { CanvasPluginBase } from "./CanvasPluginBase";
import { TPoint } from "./CanvasWorld";
import { HoverableVisualObject } from "../Node/HoverableVisualObject";
import { VisualObject } from "../Node/VisualObject";

const isHoverableObject = (obj: any): obj is HoverableVisualObject => {
    return 'handleHover' in obj && 'isHovered' in obj && 'isPointInside' in obj;
};

export class HoveringPlugin extends CanvasPluginBase {
    readonly name = "HoveringPlugin";
    private hoveredObjects: Set<HoverableVisualObject> = new Set();

    protected onInitialize(): void {
        const core = this.canvasManagerCore;
        core.eventDispatcher.registerMouseMove(
            "hover",
            (e, sp) => this.handleMouseMove(e, sp)
        );
        core.canvas.addEventListener('mouseleave', this.handleMouseLeave);
    }

    protected onDestroy(): void {
        if (this.canvasManagerCore) {
            this.canvasManagerCore.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
        }
        this.clearAllHovers();
    }

    protected onEnable(): void {
    }

    protected onDisable(): void {
        this.clearAllHovers();
    }

    private handleMouseLeave = (): void => {
        this.clearAllHovers();
    };

    private clearAllHovers(): void {
        const exitPoint = { x: -1, y: -1 };
        for (const obj of this.hoveredObjects) {
            if (obj.isHovered()) {
                obj.handleHover(exitPoint);
            }
        }
        this.hoveredObjects.clear();
    }

    private handleMouseMove(event: MouseEvent, screenPoint: TPoint): boolean {
        const core = this.canvasManagerCore;
        const worldPoint = core.canvasWorld.screenToWorld(screenPoint);
        const hoveredThisFrame = new Set<HoverableVisualObject>();
        const objectsAtPoint = this.getTopObjectsAtVisiblePoint(worldPoint);

        for (const obj of core.visibleVisualObjectsManager.getVisibleObjects()) {
            if (isHoverableObject(obj)) {
                const isTopMost = objectsAtPoint[0] === obj;
                if (isTopMost && obj.isPointInside(worldPoint)) {
                    obj.handleHover(worldPoint);
                    if (obj.isHovered()) {
                        hoveredThisFrame.add(obj);
                    }
                } else if (obj.isHovered()) {
                    obj.handleHover({ x: -1, y: -1 });
                }
            }
        }

        this.hoveredObjects = hoveredThisFrame;
        return false; // Allow propagation
    }

    private getTopObjectsAtVisiblePoint(worldPoint: TPoint): VisualObject[] {
        return this.canvasManagerCore.visibleVisualObjectsManager.getSortedVisibleObjects()
            .filter((obj: VisualObject) => isHoverableObject(obj) && obj.isPointInside(worldPoint))
            .reverse();
    }
}