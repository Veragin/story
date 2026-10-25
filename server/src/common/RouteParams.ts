import { createParamDecorator, NotFoundException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
    isEngineSection,
    isEntityKind,
    isImageOwner,
    isSourceOwner,
    routeTemplate,
    templateParams,
    type TRouteName,
    type TRouteParams,
    type TStoryRouteName,
} from '@story/protocol';
import { ProtocolRouteName } from './ProtocolRoute';

export type THandlerParams<R extends TRouteName> = R extends TStoryRouteName
    ? TRouteParams<R> & { storyId: string }
    : TRouteParams<R>;

type TParamCheck = { what: string; isValid: (value: string) => boolean };

const SOURCE_ROUTES: readonly TRouteName[] = ['getSource', 'updateSource'];

const paramCheck = (route: TRouteName, name: string): TParamCheck | null => {
    if (name === 'kind') return { what: 'entity kind', isValid: isEntityKind };
    if (name === 'section') return { what: 'engine section', isValid: isEngineSection };
    if (name !== 'owner') return null;
    return SOURCE_ROUTES.includes(route)
        ? { what: 'source owner', isValid: isSourceOwner }
        : { what: 'image owner', isValid: isImageOwner };
};

const reflector = new Reflector();

export const parseRouteParams = (route: TRouteName, raw: Readonly<Record<string, unknown>>): Record<string, string> => {
    const params: Record<string, string> = {};
    for (const name of templateParams(routeTemplate(route))) {
        const value = raw[name];
        if (typeof value !== 'string') throw new Error(`${route}: no path parameter "${name}"`);
        const check = paramCheck(route, name);
        if (check && !check.isValid(value)) throw new NotFoundException(`No ${check.what} "${value}"`);
        params[name] = value;
    }
    return params;
};

export const RouteParams = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const route = reflector.get(ProtocolRouteName, ctx.getHandler());
    if (route === undefined) throw new Error('@RouteParams() needs a @ProtocolRoute() handler');
    return parseRouteParams(route, ctx.switchToHttp().getRequest<{ params: Record<string, unknown> }>().params);
});
