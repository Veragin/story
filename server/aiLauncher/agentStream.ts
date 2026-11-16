import type { Duplex } from 'node:stream';
import type { AgentProcesses, TRunningAgent } from './AgentProcesses';
import { ndjsonLines, writeLine } from './ndjson';

export const AGENT_UPGRADE_PROTOCOL = 'story-ai-agent';

export type TLauncherStartedLine = { type: 'launcher'; event: 'started'; containerName: string; pid: number };

export type TLauncherExitedLine = { type: 'launcher'; event: 'exited'; code: number | null; stderrTail: string };

export type TLauncherControlLine = { type: 'launcher_control'; action: 'interrupt' };

type TControl = { kind: 'interrupt' } | { kind: 'ignored' } | null;

const controlOf = (line: string): TControl => {
    if (!line.includes('launcher_control')) return null;
    let message: unknown;
    try {
        message = JSON.parse(line);
    } catch {
        return null;
    }
    if (typeof message !== 'object' || message === null || !('type' in message)) return null;
    if (message.type !== 'launcher_control') return null;
    return 'action' in message && message.action === 'interrupt' ? { kind: 'interrupt' } : { kind: 'ignored' };
};

const forwardInbound = async (socket: Duplex, agent: TRunningAgent, processes: AgentProcesses): Promise<void> => {
    try {
        for await (const line of ndjsonLines(socket.iterator({ destroyOnReturn: false }))) {
            const control = controlOf(line);
            if (control?.kind === 'interrupt') processes.interrupt(agent.containerName);
            if (!control) await writeLine(agent.child.stdin, line);
        }
    } catch {
        // a reset connection ends the stream just like a close
    }
    await processes.stop(agent.containerName);
};

export const runAgentStream = async (
    socket: Duplex,
    agent: TRunningAgent,
    processes: AgentProcesses
): Promise<void> => {
    socket.once('close', () => void processes.stop(agent.containerName));
    const started: TLauncherStartedLine = {
        type: 'launcher',
        event: 'started',
        containerName: agent.containerName,
        pid: agent.pid,
    };
    await writeLine(socket, JSON.stringify(started));
    void forwardInbound(socket, agent, processes);
    for await (const line of ndjsonLines(agent.child.stdout)) await writeLine(socket, line);
    const { code } = await agent.exited;
    const exited: TLauncherExitedLine = { type: 'launcher', event: 'exited', code, stderrTail: agent.stderrTail() };
    await writeLine(socket, JSON.stringify(exited));
    socket.end(() => socket.destroy());
};
