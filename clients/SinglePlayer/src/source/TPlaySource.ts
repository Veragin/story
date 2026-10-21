import type { TPlayManifestDto } from '@story/protocol';
import type { TStorySource } from '@story/story-loader';

export type TPlaySource = TStorySource & {
    loadManifest: () => Promise<TPlayManifestDto>;
    fileUrl: (path: string) => string;
};
