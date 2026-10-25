import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { PLAY_MANIFEST_FILE, type TPlayManifestDto } from '@story/protocol';
import { exists } from '../common/fileStat';
import { HttpError } from '../common/HttpError';
import type { TEnv } from '../config/env';
import { zipStory } from '../stories/zip';

export const STANDALONE_PLAYER_DIR = Symbol('STANDALONE_PLAYER_DIR');

export const STANDALONE_PLAYER_ENTRY = 'index.html';

export const standalonePlayerDirFromConfig = (config: ConfigService<TEnv, true>): string =>
    config.get('SINGLE_PLAYER_STANDALONE_DIR', { infer: true });

const readStandalonePlayer = async (playerDir: string): Promise<Map<string, Uint8Array>> => {
    if (!(await exists(path.join(playerDir, STANDALONE_PLAYER_ENTRY)))) {
        throw HttpError.of(
            'unavailable',
            'The web export is not available: the standalone player is not built on this server (yarn workspace @story/single-player build:standalone)'
        );
    }
    const files = new Map<string, Uint8Array>();
    for (const entry of await readdir(playerDir, { recursive: true, withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const file = path.join(entry.parentPath, entry.name);
        files.set(path.relative(playerDir, file).split(path.sep).join('/'), await readFile(file));
    }
    return files;
};

export const zipPlayable = async (
    storyDir: string,
    manifest: TPlayManifestDto,
    playerDir: string
): Promise<Uint8Array> =>
    zipStory(
        storyDir,
        new Map([
            ...(await readStandalonePlayer(playerDir)),
            [PLAY_MANIFEST_FILE, new TextEncoder().encode(JSON.stringify(manifest, null, 4))],
        ])
    );
