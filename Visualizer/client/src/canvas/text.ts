let measureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
    if (measureCtx === undefined) {
        try {
            measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
        } catch {
            measureCtx = null;
        }
    }
    return measureCtx;
}

export type TFontSpec = { fontSize: number; fontFamily?: string; fontWeight?: string | number };

export const DEFAULT_FONT_FAMILY = 'system-ui, sans-serif';

export function fontString({ fontSize, fontFamily, fontWeight }: TFontSpec): string {
    return `${fontWeight ?? 'normal'} ${fontSize}px ${fontFamily ?? DEFAULT_FONT_FAMILY}`;
}

/**
 * Width of `text` in the units of `fontSize`. Uses a shared offscreen 2D context; when there is
 * none (jsdom, SSR) it falls back to an average-glyph estimate so hit-testing still works.
 */
export function measureTextWidth(text: string, font: TFontSpec): number {
    const ctx = getMeasureContext();
    if (ctx) {
        ctx.font = fontString(font);
        const w = ctx.measureText(text)?.width;
        if (typeof w === 'number' && w > 0) return w;
    }
    return text.length * font.fontSize * 0.55;
}

/** Greedy word wrap. Explicit `\n` always breaks. */
export function wrapText(text: string, maxWidth: number | undefined, font: TFontSpec): string[] {
    const paragraphs = text.split('\n');
    if (!maxWidth || maxWidth <= 0) return paragraphs;
    const lines: string[] = [];
    for (const para of paragraphs) {
        const words = para.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
            lines.push('');
            continue;
        }
        let line = words[0];
        for (const word of words.slice(1)) {
            const candidate = `${line} ${word}`;
            if (measureTextWidth(candidate, font) <= maxWidth) line = candidate;
            else {
                lines.push(line);
                line = word;
            }
        }
        lines.push(line);
    }
    return lines;
}

export type TTextBlockOptions = TFontSpec & {
    x: number;
    y: number;
    color: string;
    align?: CanvasTextAlign;
    /** Vertical placement of the whole block relative to `y`. */
    verticalAlign?: 'top' | 'middle' | 'bottom';
    lineHeight?: number;
    maxWidth?: number;
};

/** Draws (possibly wrapped) multi-line text and returns the lines it drew. */
export function drawTextBlock(ctx: CanvasRenderingContext2D, text: string, o: TTextBlockOptions): string[] {
    const lines = wrapText(text, o.maxWidth, o);
    const lineHeight = o.lineHeight ?? o.fontSize * 1.25;
    const total = lines.length * lineHeight;
    let top = o.y;
    if (o.verticalAlign === 'middle') top = o.y - total / 2;
    else if (o.verticalAlign === 'bottom') top = o.y - total;
    ctx.font = fontString(o);
    ctx.fillStyle = o.color;
    ctx.textAlign = o.align ?? 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => ctx.fillText(line, o.x, top + lineHeight * (i + 0.5)));
    return lines;
}
