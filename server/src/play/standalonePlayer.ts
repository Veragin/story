import type { ConfigService } from '@nestjs/config';
import { PLAY_MANIFEST_FILE, type TPlayManifestDto } from '@story/protocol';
import { HttpError } from '../common/HttpError';
import type { TEnv } from '../config/env';
import { readBytesOrNull } from '../json/atomicWrite';
import { zipStory } from '../stories/zip';

export const STANDALONE_PLAYER_HTML = Symbol('STANDALONE_PLAYER_HTML');

export const STANDALONE_PLAYER_FILE = 'index.html';

export const standalonePlayerHtmlFromConfig = (config: ConfigService<TEnv, true>): string =>
    config.get('SINGLE_PLAYER_STANDALONE_HTML', { infer: true });

const readStandalonePlayer = async (htmlFile: string): Promise<Uint8Array> => {
    const html = await readBytesOrNull(htmlFile);
    if (html === null) {
        throw HttpError.of(
            'unavailable',
            'The web export is not available: the standalone player is not built on this server (yarn workspace @story/single-player build:standalone)'
        );
    }
    return html;
};

export const zipPlayable = async (
    storyDir: string,
    manifest: TPlayManifestDto,
    htmlFile: string
): Promise<Uint8Array> =>
    zipStory(
        storyDir,
        new Map([
            [STANDALONE_PLAYER_FILE, await readStandalonePlayer(htmlFile)],
            [PLAY_MANIFEST_FILE, new TextEncoder().encode(JSON.stringify(manifest, null, 4))],
        ])
    );
