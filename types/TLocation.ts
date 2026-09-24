import type { register, TWorldState } from '@story/data';
import type { TColor, TPolygon } from '@story/shared';
import type { TMapId } from './TMap';

export type TLocation<L extends TLocationId> = {
    id: L;
    name: string;
    description: string;

    localCharacters: {
        name: string;
        description: string;
    }[];

    sublocations?: TLocation<TLocationId>[];
    mapId?: string;

    /**
     * Where this location sits on a map — the README's "location knows its position by points
     * of polygon mash shape" (VISUALIZER_PLAN §4.2). Written by the Visualizer's map tab.
     *
     * Optional, and deliberately so: a story with no map stays valid, and the two locations
     * this story already has needed no edit when the field was added.
     */
    shape?: {
        mapId: TMapId;
        /**
         * World units, clockwise, **implicitly closed** — a triangle is three points, never
         * four. The Visualizer normalises winding and drops any duplicated closing point on
         * every write, so the same shape always produces the same diff however it was drawn.
         */
        points: TPolygon;
        color: TColor;
        /** Paint order against other locations on the same map. Higher draws on top. */
        z?: number;
    };

    init: Partial<TWorldState['locations'][L]>;
};

export type TLocationId = keyof (typeof register)['locations'];
