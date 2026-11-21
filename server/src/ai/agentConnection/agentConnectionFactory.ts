import { createGeminiClient } from '../../../aiLauncher/gemini/geminiClient';
import type { StoryFolders } from '../../stories/StoryFolders';
import type { TAiOptions } from '../aiOptions';
import { imageTimeoutOf, LauncherConnection } from './LauncherConnection';
import { LocalConnection } from './LocalConnection';
import type { TAgentConnection } from './TAgentConnection';

export const createAgentConnection = (options: TAiOptions, folders: StoryFolders): TAgentConnection =>
    options.sandbox === 'none'
        ? new LocalConnection((storyId) => folders.dir(storyId), {
              client: options.localGeminiKey ? createGeminiClient(options.localGeminiKey) : null,
              timeoutMs: options.gemini.timeoutMs,
          })
        : new LauncherConnection({
              url: options.launcherUrl,
              keyFile: options.launcherKeyFile,
              sessionsDir: options.sessionsDir,
              requireApiKey: options.requireApiKey,
              imageTimeoutMs: imageTimeoutOf(options.gemini.timeoutMs),
          });
