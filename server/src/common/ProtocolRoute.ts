import { applyDecorators, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
    CREATED_ROUTES,
    NO_CONTENT_ROUTES,
    routeDef,
    routeTemplate,
    type THttpMethod,
    type TRouteName,
} from '@story/protocol';

const METHOD_DECORATORS = { GET: Get, POST: Post, PUT: Put, DELETE: Delete } satisfies Record<
    THttpMethod,
    (path: string) => MethodDecorator
>;

export const ProtocolRouteName = Reflector.createDecorator<TRouteName>();

export const routeStatus = (route: TRouteName): HttpStatus => {
    if (CREATED_ROUTES.includes(route)) return HttpStatus.CREATED;
    if (NO_CONTENT_ROUTES.includes(route)) return HttpStatus.NO_CONTENT;
    return HttpStatus.OK;
};

export const ProtocolRoute = (route: TRouteName) =>
    applyDecorators(
        METHOD_DECORATORS[routeDef(route).method](routeTemplate(route)),
        ProtocolRouteName(route),
        HttpCode(routeStatus(route))
    );
