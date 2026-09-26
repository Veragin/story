import { MapWrapper } from '../../MapEditor/MapWrapper';

/**
 * Map page (`#/map`). For now it renders the existing mapMaker port; WP4 replaces this with the
 * tiles + Locations layers, the mode switch and autosave.
 */
export default function MapPage() {
    return <MapWrapper mapId="global" />;
}
