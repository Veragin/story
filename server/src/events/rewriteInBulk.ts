import { listFilesRecursive } from '../common/listFiles';
import { readBytesOrNull } from '../json/atomicWrite';
import type { ProjectRoot } from '../project/ProjectRoot';
import type { EventBus } from './EventBus';
import { isUnwatched } from './watcher';

type TOutcome<T> = { ok: true; value: T } | { ok: false; error: unknown };

const watchedFiles = async ({ dataDir, typesDir }: ProjectRoot): Promise<string[]> => {
    const files = [...(await listFilesRecursive(dataDir)), ...(await listFilesRecursive(typesDir))];
    return files.filter((file) => !isUnwatched(file));
};

// for a rewrite by another program (git): the watcher's reports of it are dropped, even when it fails
// (an aborted merge touched the files too), and the caller announces the change as a whole
export const rewriteInBulk = async <T>(bus: EventBus, rewrite: () => Promise<T>): Promise<T> => {
    const outcome = await bus.transaction(async (tx): Promise<TOutcome<T>> => {
        const before = await watchedFiles(tx.project);
        try {
            return { ok: true, value: await rewrite() };
        } catch (error) {
            return { ok: false, error };
        } finally {
            const after = await watchedFiles(tx.project);
            for (const file of new Set([...before, ...after])) tx.expect(file, await readBytesOrNull(file));
        }
    });
    await bus.settle();
    if (!outcome.ok) throw outcome.error;
    return outcome.value;
};
