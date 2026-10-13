import { Controller } from '@nestjs/common';
import type { THealthDto } from '@story/protocol';
import { ProtocolRoute } from '../common/ProtocolRoute';
import { HealthService } from './HealthService';

@Controller()
export class HealthController {
    constructor(private readonly health: HealthService) {}

    @ProtocolRoute('health')
    check(): Promise<THealthDto> {
        return this.health.check();
    }
}
