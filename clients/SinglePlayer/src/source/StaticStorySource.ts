import type { TPlayManifestDto } from '@story/protocol';
import { fetchOk } from '../storyApi';
import type { TPlaySource } from './TPlaySource';

const MANIFEST_FILE = 'play.json';

export class StaticStorySource implements TPlaySource {
    constructor(private readonly baseUrl: string = document.baseURI) {}

    loadManifest = async (): Promise<TPlayManifestDto> => {
        const manifest: TPlayManifestDto = await (await fetchOk(this.fileUrl(MANIFEST_FILE))).json();
        return manifest;
    };

    fileUrl = (path: string): string => new URL(path, this.baseUrl).href;

    fetchText = async (path: string): Promise<string> => (await fetchOk(this.fileUrl(path))).text();
}
