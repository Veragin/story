import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_HEALTH_RETRY_MS, AiAvailability } from '../../src/ai/AiAvailability';
import { FakeAgentConnection } from '../helpers/FakeAgentConnection';

let availability: AiAvailability | undefined;

afterEach(() => {
    availability?.onModuleDestroy();
    availability = undefined;
    vi.useRealTimers();
});

const checked = async (connection: FakeAgentConnection) => {
    availability = new AiAvailability(connection);
    await availability.onModuleInit();
    return availability;
};

describe('AiAvailability', () => {
    it('keeps the agents and image generation apart', async () => {
        const connection = new FakeAgentConnection('/tmp');
        connection.healthResult = { available: false, reason: 'no token' };
        const ai = await checked(connection);
        expect([ai.available, ai.reason, ai.imageGeneration]).toEqual([false, 'no token', true]);
    });

    it('retries while either is unavailable, and stops once both are', async () => {
        vi.useFakeTimers();
        const connection = new FakeAgentConnection('/tmp');
        connection.imageGeneration = false;
        const health = vi.spyOn(connection, 'health');
        const ai = await checked(connection);
        expect([ai.available, ai.imageGeneration]).toEqual([true, false]);

        connection.imageGeneration = true;
        await vi.advanceTimersByTimeAsync(AI_HEALTH_RETRY_MS);
        expect(ai.imageGeneration).toBe(true);
        expect(health).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(AI_HEALTH_RETRY_MS * 3);
        expect(health).toHaveBeenCalledTimes(2);
    });
});
