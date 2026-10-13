import { Controller, Get } from '@nestjs/common';
import { GLOBAL_ROUTES, type THealthDto } from '@story/protocol';
import { HealthService } from './HealthService';

@Controller()
export class HealthController {
    constructor(private readonly health: HealthService) {}

    @Get(GLOBAL_ROUTES.health.path)
    check(): Promise<THealthDto> {
        return this.health.check();
    }
}
