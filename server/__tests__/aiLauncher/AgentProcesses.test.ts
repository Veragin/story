import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentProcesses } from '../../aiLauncher/AgentProcesses';
import { FakeDriver } from './fakeAgent';

const REQUEST = { storyId: 'demo', maxBudgetUsd: 1 };

let driver: FakeDriver;
let processes: AgentProcesses;

beforeEach(() => {
    vi.useFakeTimers();
    driver = new FakeDriver();
    processes = new AgentProcesses(driver, { removeAfterMs: 10_000, stderrTailBytes: 8 }, () => undefined);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('AgentProcesses', () => {
    it('tracks running agents until they exit', async () => {
        const agent = await processes.start(REQUEST);
        expect(processes.list()).toEqual([{ containerName: agent.containerName, storyId: 'demo', pid: 4242 }]);
        driver.lastChild().exit(0);
        await vi.runAllTimersAsync();
        expect(await agent.exited).toEqual({ code: 0, signal: null });
        expect(processes.list()).toEqual([]);
    });

    it('keeps the stderr tail', async () => {
        const agent = await processes.start(REQUEST);
        driver.lastChild().stderr.write('0123456789abcdef');
        await vi.runAllTimersAsync();
        expect(agent.stderrTail()).toBe('89abcdef');
    });

    it('stops: closes stdin, SIGTERM, docker stop; no rm when it exits in time', async () => {
        const agent = await processes.start(REQUEST);
        const child = driver.lastChild();
        const stdinEnded = vi.fn();
        child.stdin.on('finish', stdinEnded);
        child.stdin.resume();
        const stopping = processes.stop(agent.containerName);
        await vi.advanceTimersByTimeAsync(0);
        expect(stdinEnded).toHaveBeenCalled();
        expect(child.signals).toEqual(['SIGTERM']);
        expect(driver.calls).toEqual([`stop ${agent.containerName}`]);
        await vi.advanceTimersByTimeAsync(3_000);
        child.exit(143);
        await vi.advanceTimersByTimeAsync(0);
        expect(await stopping).toBe(true);
        await vi.advanceTimersByTimeAsync(20_000);
        expect(driver.calls).toEqual([`stop ${agent.containerName}`]);
    });

    it('removes the container with docker rm -f after 10 s', async () => {
        const agent = await processes.start(REQUEST);
        const child = driver.lastChild();
        const stopping = processes.stop(agent.containerName);
        await vi.advanceTimersByTimeAsync(9_999);
        expect(driver.calls).toEqual([`stop ${agent.containerName}`]);
        await vi.advanceTimersByTimeAsync(1);
        expect(driver.calls).toEqual([`stop ${agent.containerName}`, `rm ${agent.containerName}`]);
        expect(child.signals).toEqual(['SIGTERM', 'SIGKILL']);
        expect(await stopping).toBe(true);
    });

    it('runs the stop sequence once for concurrent stops', async () => {
        const agent = await processes.start(REQUEST);
        const both = Promise.all([processes.stop(agent.containerName), processes.stop(agent.containerName)]);
        driver.lastChild().exit(0);
        await vi.runAllTimersAsync();
        expect(await both).toEqual([true, true]);
        expect(driver.lastChild().signals).toEqual(['SIGTERM']);
        expect(await processes.stop(agent.containerName)).toBe(false);
    });

    it('interrupts with SIGINT and cleans orphans through the driver', async () => {
        const agent = await processes.start(REQUEST);
        expect(processes.interrupt(agent.containerName)).toBe(true);
        expect(processes.interrupt('story-ai-unknown')).toBe(false);
        expect(driver.lastChild().signals).toEqual(['SIGINT']);
        driver.orphans = 3;
        expect(await processes.cleanupOrphans()).toBe(3);
    });
});
