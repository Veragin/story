import { Module, type DynamicModule } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import type { TRouteName } from '@story/protocol';
import { NOT_YET_PORTED, ProtocolRouteCheck } from './ProtocolRouteCheck';

@Module({})
export class ProtocolRoutesModule {
    static forRoot(notYetPorted: readonly TRouteName[]): DynamicModule {
        return {
            module: ProtocolRoutesModule,
            imports: [DiscoveryModule],
            providers: [{ provide: NOT_YET_PORTED, useValue: notYetPorted }, ProtocolRouteCheck],
        };
    }
}
