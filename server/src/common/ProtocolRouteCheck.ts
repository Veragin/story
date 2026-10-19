import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { ProtocolRouteName } from './ProtocolRoute';
import { isRouteName, ROUTE_NAMES } from '@story/protocol';

type THandlerRef = { route: string; where: string };

export const routeProblems = (handlers: readonly THandlerRef[]): string[] => {
    const problems: string[] = [];
    const byRoute = new Map<string, THandlerRef[]>();
    for (const handler of handlers) byRoute.set(handler.route, [...(byRoute.get(handler.route) ?? []), handler]);
    for (const [route, refs] of byRoute) {
        const where = refs.map((ref) => ref.where).join(', ');
        if (!isRouteName(route)) problems.push(`Unknown protocol route "${route}" (${where})`);
        else if (refs.length > 1) problems.push(`Protocol route ${route} has ${refs.length} handlers (${where})`);
    }
    const missing = ROUTE_NAMES.filter((route) => !byRoute.has(route));
    if (missing.length > 0) problems.push(`Protocol routes without a handler: ${missing.join(', ')}`);
    return problems;
};

@Injectable()
export class ProtocolRouteCheck implements OnApplicationBootstrap {
    constructor(
        private readonly discovery: DiscoveryService,
        private readonly scanner: MetadataScanner,
        private readonly reflector: Reflector
    ) {}

    onApplicationBootstrap(): void {
        const problems = routeProblems(this.handlers());
        if (problems.length > 0) throw new Error(problems.join('\n'));
    }

    private handlers(): THandlerRef[] {
        return this.discovery.getControllers().flatMap(({ metatype }) => {
            if (typeof metatype !== 'function') return [];
            const prototype: unknown = metatype.prototype;
            if (typeof prototype !== 'object' || prototype === null) return [];
            return this.scanner.getAllMethodNames(prototype).flatMap((method) => {
                const handler: unknown = Reflect.get(prototype, method);
                if (typeof handler !== 'function') return [];
                const route: unknown = this.reflector.get(ProtocolRouteName, handler);
                return typeof route === 'string' ? [{ route, where: `${metatype.name}.${method}` }] : [];
            });
        });
    }
}
