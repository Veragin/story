import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * §4.3's third mitigation: the size budget on a map's brush strokes.
 *
 * *"The server rejects a `strokes` payload over a configured budget (default 2 MB per map) with
 * `413` rather than writing a file no one can merge."*
 *
 * The other two mitigations are the client's — coordinates are rounded to integers and the
 * stroke is simplified with Ramer–Douglas–Peucker before it is ever sent. This one is the
 * server's on purpose, because it is a statement about the **repository** rather than about the
 * drawing: a 3 MB source file is unreviewable and unmergeable whatever produced it, and a client
 * with a bug — or an author scripting against the API — must not be able to commit one.
 *
 * Measured on the **rendered source text**, not on the point count. The point count is a proxy;
 * the bytes that land in the author's file are the thing the budget is about, and the two come
 * apart as soon as coordinates get long or a stroke carries a long id.
 *
 * Split out of the controller so it can be tested directly: reaching it through HTTP would mean
 * booting Nest and holding a 2 MB request in a test.
 */

/** §4.3's stated default. */
export const DEFAULT_STROKE_BUDGET_BYTES = 2 * 1024 * 1024;

/** The budget in force, from `VISUALIZER_STROKE_BUDGET_BYTES` or the default. */
export const strokeBudgetBytes = (): number => {
    const configured = Number(process.env.VISUALIZER_STROKE_BUDGET_BYTES);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_STROKE_BUDGET_BYTES;
};

/** Throws a `413` when `renderedStrokes` is over `budget`. Returns the size when it is not. */
export const assertStrokeBudget = (renderedStrokes: string, mapId: string, budget = strokeBudgetBytes()): number => {
    const bytes = Buffer.byteLength(renderedStrokes, 'utf8');
    if (bytes <= budget) return bytes;

    throw new HttpException(
        {
            success: false,
            error:
                `Stroke data for map "${mapId}" is ${formatBytes(bytes)}, over the ${formatBytes(budget)} budget. ` +
                `Simplify or erase some strokes, or bake them into a background image.`,
            bytes,
            budget,
        },
        HttpStatus.PAYLOAD_TOO_LARGE
    );
};

export const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    // Below a kilobyte, report bytes: a 400-byte budget rendered as "0 kB" makes the error
    // message read as a bug rather than as a configuration the operator chose.
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} kB`;
    return `${bytes} bytes`;
};
