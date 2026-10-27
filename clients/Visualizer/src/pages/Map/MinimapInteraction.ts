import { reaction } from 'mobx';
import type { ISceneInteraction, Scene, TPoint, TScenePointerEvent } from '../../canvas';
import { minimapSize } from '../../MapEditor/MapEngine/utils';
import type { MapStore } from '../../MapEditor/MapStore';

// the minimap is drawn on the tiles canvas below the scene, so the scene leaves its corner clear and claims its input
export class MinimapInteraction implements ISceneInteraction {
    readonly priority = 100;
    private readonly disposers: (() => void)[];

    constructor(
        private readonly scene: Scene,
        private readonly mapStore: MapStore
    ) {
        this.disposers = [
            scene.addInteraction(this),
            scene.addDrawHook(this.clearMinimapArea, 'screen'),
            reaction(
                () => mapStore.showMinimap,
                () => scene.invalidate()
            ),
        ];
    }

    destroy = () => {
        for (const d of this.disposers.splice(0)) d();
    };

    onPointerDown(e: TScenePointerEvent): boolean {
        if (!this.isOn(e.screen)) return false;
        this.mapStore.moveByMinimap(e.screen, this.scene.size);
        return true;
    }

    onPointerMove(e: TScenePointerEvent): void {
        this.mapStore.moveByMinimap(e.screen, this.scene.size);
    }

    onClick(e: TScenePointerEvent): boolean {
        return this.isOn(e.screen);
    }

    onDoubleClick(e: TScenePointerEvent): boolean {
        return this.isOn(e.screen);
    }

    getCursor(e: TScenePointerEvent): string | undefined {
        return this.isOn(e.screen) ? 'default' : undefined;
    }

    private isOn(screen: TPoint) {
        return this.mapStore.isOnMinimap(screen, this.scene.size);
    }

    private clearMinimapArea = (ctx: CanvasRenderingContext2D) => {
        const map = this.mapStore.data;
        if (!map || !this.mapStore.showMinimap) return;
        const size = this.scene.size;
        const mini = minimapSize(size, map);
        ctx.clearRect(0, size.height - mini.height, mini.width, mini.height);
    };
}
