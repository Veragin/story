import type { TGeneratedImage, TImageGeneration } from '../../../aiLauncher/gemini/generateImage';
import type { TLaunchRequest } from '../../../aiLauncher/launchRequest';

export const AGENT_CONNECTION = Symbol('AGENT_CONNECTION');

export type TAgentLaunch = TLaunchRequest;

export type TAgentHandle = { pid: number; containerName: string };

export type TAgentExit = { code: number | null; stderrTail: string };

export type TAgentStream = {
    readonly handle: TAgentHandle;
    // the CLI's stream-json stdout lines; ends when the agent exits
    readonly lines: AsyncIterable<string>;
    // settles once `lines` has been read to the end
    readonly exited: Promise<TAgentExit>;
    send: (line: string) => Promise<void>;
    // SIGINT for the agent process: the fallback when the CLI ignores a stream-json interrupt
    interrupt: () => Promise<void>;
    // closes the agent's stdin side; the agent is stopped and `exited` settles
    close: () => void;
};

export type TAiHealth = { available: true } | { available: false; reason: string };

// `agents`: Claude agents can run; `imageGeneration`: Gemini images can be generated, independent of the agents
export type TAgentHealth = { agents: TAiHealth; imageGeneration: boolean };

// `storyRoot`: the story folder as the agent sees it; `sessionsRoot`: the story's Claude Code projects folder on the
// server, created before a spawn; `transcriptsDir`: where `<sessionId>.jsonl` transcripts are
export type TAgentLayout = { storyRoot: string; sessionsRoot: string; transcriptsDir: string };

export type TAgentConnection = {
    health: () => Promise<TAgentHealth>;
    open: (launch: TAgentLaunch) => Promise<TAgentStream>;
    // stops every agent, including orphans of an earlier server run; returns how many were removed
    cleanupAll: () => Promise<number>;
    layout: (storyId: string) => TAgentLayout;
    // rejects with an HttpError: `ai_image_failed`, `ai_unavailable` or `too_many_requests`
    generateImage: (storyId: string, request: TImageGeneration) => Promise<TGeneratedImage>;
};
