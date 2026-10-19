import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ProtocolRouteCheck } from './ProtocolRouteCheck';

@Module({
    imports: [DiscoveryModule],
    providers: [ProtocolRouteCheck],
})
export class ProtocolRoutesModule {}
