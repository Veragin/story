import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync, zipSync, type Zippable } from 'fflate';
import { errorMessage, HttpError } from '../http/HttpError';
import { isTempFile } from '../json/atomicWrite';
import { STORY_FILE } from './StoryStore';

const TOP_FILES = [STORY_FILE, 'tsconfig.json'];
const TOP_DIRS = ['data', 'types'];

const MAX_ENTRIES = 10_000;
const MAX_UNPACKED_BYTES = 200 * 1024 * 1024;

// fixed so an export depends only on content; DOS time is local and starts in 1980
const ZIP_MTIME = new Date(1980, 0, 2);

const exportedFiles = async (storyDir: string): Promise<[string, string][]> => {
    const out: [string, string][] = [];
    const walk = async (rel: string) => {
        const entries = await readdir(path.join(storyDir, rel), { withFileTypes: true });
        for (const e of entries) {
            const childRel = `${rel}/${e.name}`;
            if (e.isDirectory()) {
                if (e.name !== 'node_modules') await walk(childRel);
            } else if (e.isFile() && !isTempFile(e.name)) {
                out.push([childRel, path.join(storyDir, childRel)]);
            }
            // anything else (a symlink, a socket) is not part of a story
        }
    };
    for (const name of TOP_FILES) {
        const abs = path.join(storyDir, name);
        if ((await lstat(abs).catch(() => null))?.isFile()) out.push([name, abs]);
    }
    for (const name of TOP_DIRS) {
        if ((await lstat(path.join(storyDir, name)).catch(() => null))?.isDirectory()) await walk(name);
    }
    return out.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
};

export const zipStory = async (storyDir: string): Promise<Uint8Array> => {
    const files: Zippable = {};
    for (const [rel, abs] of await exportedFiles(storyDir)) {
        files[rel] = new Uint8Array(await readFile(abs));
    }
    return zipSync(files, { level: 6, mtime: ZIP_MTIME });
};

type TZipEntry = { name: string; symlink: boolean; encrypted: boolean; size: number };

// fflate does not report symlinks, so the central directory is read directly
const readCentralDirectory = (zip: Uint8Array): TZipEntry[] => {
    const bad = (why: string) => HttpError.badRequest(`Not a valid zip: ${why}`);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    // end of central directory record: 22 bytes + a comment of up to 65535
    let eocd = -1;
    for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) throw bad('no end of central directory');
    const count = view.getUint16(eocd + 10, true);
    const size = view.getUint32(eocd + 12, true);
    let offset = view.getUint32(eocd + 16, true);
    if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) throw bad('ZIP64 is not supported');
    if (count > MAX_ENTRIES) throw HttpError.badRequest(`The zip has more than ${MAX_ENTRIES} entries`);
    if (offset + size > eocd) throw bad('central directory out of range');

    const utf8 = new TextDecoder();
    const entries: TZipEntry[] = [];
    for (let k = 0; k < count; k++) {
        if (offset + 46 > eocd || view.getUint32(offset, true) !== 0x02014b50) throw bad('broken central directory');
        const madeBy = view.getUint16(offset + 4, true);
        const flags = view.getUint16(offset + 8, true);
        const unpacked = view.getUint32(offset + 24, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const mode = view.getUint32(offset + 38, true) >>> 16;
        const raw = zip.subarray(offset + 46, offset + 46 + nameLength);
        // decoded the way fflate does, so the names match what `unzipSync` reports
        const name = flags & 0x800 ? utf8.decode(raw) : String.fromCharCode(...raw);
        entries.push({
            name,
            // "made by" unix (3) with a symlink file type in the mode
            symlink: madeBy >> 8 === 3 && (mode & 0o170000) === 0o120000,
            encrypted: (flags & 1) !== 0,
            size: unpacked,
        });
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
};

const entryPath = (name: string): string | null => {
    const refuse = (why: string) => HttpError.badRequest(`Zip entry ${JSON.stringify(name)}: ${why}`);
    if (name === '' || name.startsWith('/') || name.includes('\\') || /^[A-Za-z]:/.test(name) || name.includes('\0')) {
        throw refuse('not a relative path');
    }
    const isDir = name.endsWith('/');
    const segments = (isDir ? name.slice(0, -1) : name).split('/');
    if (segments.some((s) => s === '' || s === '.' || s === '..')) throw refuse('not a plain relative path');
    const [top] = segments;
    if (segments.length === 1 ? !(isDir ? TOP_DIRS : TOP_FILES).includes(top) : !TOP_DIRS.includes(top)) {
        throw refuse(`a story zip holds only ${[...TOP_FILES, ...TOP_DIRS.map((d) => `${d}/`)].join(', ')}`);
    }
    return isDir ? null : segments.join('/');
};

export const unzipStory = (zip: Uint8Array): Map<string, Uint8Array> => {
    const entries = readCentralDirectory(zip);
    const wanted = new Set<string>();
    let total = 0;
    for (const entry of entries) {
        const rel = entryPath(entry.name);
        if (entry.symlink)
            throw HttpError.badRequest(`Zip entry ${JSON.stringify(entry.name)}: symlinks are not allowed`);
        if (entry.encrypted) throw HttpError.badRequest(`Zip entry ${JSON.stringify(entry.name)} is encrypted`);
        if (rel === null) continue;
        if (wanted.has(rel)) throw HttpError.badRequest(`Zip entry ${JSON.stringify(entry.name)} appears twice`);
        wanted.add(rel);
        total += entry.size;
    }
    if (!wanted.has(STORY_FILE)) throw HttpError.badRequest(`The zip has no ${STORY_FILE} at its root`);
    if (total > MAX_UNPACKED_BYTES) {
        throw HttpError.badRequest(`The zip unpacks to more than ${MAX_UNPACKED_BYTES} bytes`);
    }

    let unpacked: Record<string, Uint8Array>;
    try {
        unpacked = unzipSync(zip, { filter: (file) => wanted.has(file.name) });
    } catch (e) {
        throw HttpError.badRequest(`Not a valid zip: ${errorMessage(e)}`);
    }
    const files = new Map<string, Uint8Array>();
    let actual = 0;
    for (const [name, bytes] of Object.entries(unpacked)) {
        actual += bytes.length;
        files.set(name, bytes);
    }
    // the sizes above are what the zip claims; check what it really held too
    if (actual > MAX_UNPACKED_BYTES) {
        throw HttpError.badRequest(`The zip unpacks to more than ${MAX_UNPACKED_BYTES} bytes`);
    }
    return files;
};
