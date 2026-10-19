import { BODYLESS_ROUTES, routeDef, STORY_IMPORT_CONTENT_TYPE, type TRouteName } from '@story/protocol';

export const JSON_CONTENT_TYPE = 'application/json';

const ROUTE_CONTENT_TYPES: Partial<Record<TRouteName, string>> = { importStory: STORY_IMPORT_CONTENT_TYPE };

export const routeContentType = (route: TRouteName): string => ROUTE_CONTENT_TYPES[route] ?? JSON_CONTENT_TYPE;

export const takesJsonBody = (route: TRouteName): boolean =>
    routeDef(route).method !== 'GET' &&
    !BODYLESS_ROUTES.includes(route) &&
    routeContentType(route) === JSON_CONTENT_TYPE;

export const isVersionedRoute = (route: TRouteName): boolean => {
    const { method } = routeDef(route);
    return method === 'PUT' || method === 'DELETE';
};
