import { randomBytes } from 'node:crypto';
import { isStoryId } from '@story/protocol';
import { AI_TOKEN_ENV, type TAiTokenKind } from '../aiToken';
import type { TStoriesMount } from '../launcherOptions';
import { formatUsd, type TLaunchRequest } from '../launchRequest';

export type TDockerRunConfig = {
    image: string;
    network: string;
    instance: string;
    stories: TStoriesMount;
    repoHostDir: string | null;
    sessionsVolume: string;
};

export type TAgentLaunch = TLaunchRequest & { containerName: string; tokenKind: TAiTokenKind };

export const AGENT_LABEL = 'story-ai';
export const AGENT_STORY_LABEL = 'story-ai.story-id';
export const AGENT_INSTANCE_LABEL = 'story-ai.instance';
export const AGENT_UID = 1000;

export const CONTAINER_REPO = '/repo';
export const CONTAINER_STORY_DIR = `${CONTAINER_REPO}/stories/story`;
export const CONTAINER_HOME = '/home/agent';
export const CONTAINER_SESSIONS_DIR = `${CONTAINER_HOME}/.claude/projects`;

export const STORY_MOUNT_FOLDERS = ['data', 'types'] as const;

export const ENGINE_MOUNT_PATHS = [
    'tsconfig.base.json',
    'clients/shared/core',
    'clients/shared/utils',
    'clients/shared/ui',
    'node_modules/@types/react',
    'node_modules/@mui/icons-material',
] as const;

export const ALLOWED_TOOLS = ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Skill'] as const;
export const DISALLOWED_TOOLS = ['Bash', 'WebFetch', 'WebSearch'] as const;

const HARDENING_ARGS = [
    '--read-only',
    '--tmpfs',
    '/tmp',
    '--tmpfs',
    `${CONTAINER_HOME}:rw,uid=${AGENT_UID},gid=${AGENT_UID},mode=0700,size=64m`,
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--pids-limit',
    '256',
    '--memory',
    '1g',
    '--cpus',
    '1',
    '--user',
    `${AGENT_UID}:${AGENT_UID}`,
];

export const agentLabelFilters = (instance: string): string[] => [
    '--filter',
    `label=${AGENT_LABEL}=1`,
    '--filter',
    `label=${AGENT_INSTANCE_LABEL}=${instance}`,
];

const checkedStoryId = (storyId: string): string => {
    if (!isStoryId(storyId)) throw new Error(`Invalid story id: ${JSON.stringify(storyId)}`);
    return storyId;
};

export const agentContainerName = (storyId: string): string =>
    `${AGENT_LABEL}-${checkedStoryId(storyId)}-${randomBytes(4).toString('hex')}`;

const mount = (...options: string[]) => ['--mount', options.join(',')];

const volumeMount = (volume: string, target: string, subpath: string) =>
    mount('type=volume', `src=${volume}`, `dst=${target}`, `volume-subpath=${subpath}`);

const bindMount = (source: string, target: string, readonly = false) =>
    mount('type=bind', `src=${source}`, `dst=${target}`, ...(readonly ? ['readonly'] : []));

const storyMounts = (stories: TStoriesMount, storyId: string): string[] =>
    STORY_MOUNT_FOLDERS.flatMap((folder) =>
        stories.kind === 'volume'
            ? volumeMount(stories.volume, `${CONTAINER_STORY_DIR}/${folder}`, `${storyId}/${folder}`)
            : bindMount(`${stories.hostDir}/${storyId}/${folder}`, `${CONTAINER_STORY_DIR}/${folder}`)
    );

const engineMounts = (repoHostDir: string | null): string[] =>
    repoHostDir === null
        ? []
        : ENGINE_MOUNT_PATHS.flatMap((entry) =>
              bindMount(`${repoHostDir}/${entry}`, `${CONTAINER_REPO}/${entry}`, true)
          );

export const claudeArgs = (launch: TLaunchRequest): string[] => [
    '-p',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-mode',
    'acceptEdits',
    '--allowedTools',
    ALLOWED_TOOLS.join(','),
    '--disallowedTools',
    DISALLOWED_TOOLS.join(','),
    '--max-budget-usd',
    formatUsd(launch.maxBudgetUsd),
    ...(launch.resumeSessionId ? ['--resume', launch.resumeSessionId] : []),
    ...(launch.model ? ['--model', launch.model] : []),
];

export const dockerRunArgs = (config: TDockerRunConfig, launch: TAgentLaunch): string[] => {
    const storyId = checkedStoryId(launch.storyId);
    return [
        'run',
        '--rm',
        '-i',
        '--name',
        launch.containerName,
        '--label',
        `${AGENT_LABEL}=1`,
        '--label',
        `${AGENT_STORY_LABEL}=${storyId}`,
        '--label',
        `${AGENT_INSTANCE_LABEL}=${config.instance}`,
        '--network',
        config.network,
        ...HARDENING_ARGS,
        ...engineMounts(config.stories.kind === 'bind' ? config.repoHostDir : null),
        ...storyMounts(config.stories, storyId),
        ...volumeMount(config.sessionsVolume, CONTAINER_SESSIONS_DIR, storyId),
        '-e',
        AI_TOKEN_ENV[launch.tokenKind],
        config.image,
        ...claudeArgs(launch),
    ];
};
