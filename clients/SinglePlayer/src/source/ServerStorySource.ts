import { buildPath, type TPlayManifestDto } from '@story/protocol';
import { fetchOk } from '../storyApi';
import type { TPlaySource } from './TPlaySource';

export class ServerStorySource implements TPlaySource {
    constructor(readonly storyId: string) {}

    loadManifest = async (): Promise<TPlayManifestDto> => {
        const manifest: TPlayManifestDto = await (await fetchOk(buildPath(this.storyId, 'getPlayManifest', {}))).json();
        return manifest;
    };

    fileUrl = (path: string): string => buildPath(this.storyId, 'getPlayFile', { file: path });

    fetchText = async (path: string): Promise<string> => (await fetchOk(this.fileUrl(path))).text();
}
