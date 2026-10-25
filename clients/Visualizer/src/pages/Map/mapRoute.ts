import { GLOBAL_MAP_ID } from '@story/protocol';
import type { TRoute } from '../../shell';

export const mapRoute = (mapId: string): TRoute => (mapId === GLOBAL_MAP_ID ? { page: 'map' } : { page: 'map', mapId });
