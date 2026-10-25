import { BODYLESS_ROUTES, routeDef, STORY_IMPORT_CONTENT_TYPE, type TRouteName } from '@story/protocol';

export const JSON_CONTENT_TYPE = 'application/json';

const ROUTE_CONTENT_TYPES: Partial<Record<TRouteName, string>> = {
    importStory: STORY_IMPORT_CONTENT_TYPE,
    addStoryFiles: STORY_IMPORT_CONTENT_TYPE,
};

export const routeContentType = (route: TRouteName): string => ROUTE_CONTENT_TYPES[route] ?? JSON_CONTENT_TYPE;

export const takesJsonBody = (route: TRouteName): boolean =>
    routeDef(route).method !== 'GET' &&
    !BODYLESS_ROUTES.includes(route) &&
    routeContentType(route) === JSON_CONTENT_TYPE;

// replaces a resource that is not versioned: the reset token is what it is based on
const UNVERSIONED_ROUTES: readonly TRouteName[] = ['resetPassword'];

export const isVersionedRoute = (route: TRouteName): boolean => {
    const { method } = routeDef(route);
    return (method === 'PUT' || method === 'DELETE') && !UNVERSIONED_ROUTES.includes(route);
};
