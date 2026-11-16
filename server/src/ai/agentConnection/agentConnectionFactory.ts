import { LauncherConnection } from './LauncherConnection';
import { LocalConnection } from './LocalConnection';
import type { TAgentConnection } from './TAgentConnection';
import type { TAiOptions } from '../aiOptions';
import type { StoryFolders } from '../../stories/StoryFolders';

export const createAgentConnection = (options: TAiOptions, folders: StoryFolders): TAgentConnection =>
    options.sandbox === 'none'
        ? new LocalConnection((storyId) => folders.dir(storyId))
        : new LauncherConnection({
              url: options.launcherUrl,
              keyFile: options.launcherKeyFile,
              sessionsDir: options.sessionsDir,
              requireApiKey: options.requireApiKey,
          });
