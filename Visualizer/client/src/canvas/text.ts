let measureCtx: CanvasRenderingContext2D | null | undefined;

const getMeasureContext = (): CanvasRenderingContext2D | null => {
    if (measureCtx === undefined) {
        try {
            measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
        } catch {
            measureCtx = null;
        }
    }
    return measureCtx;
};

export type TFontSpec = { fontSize: number; fontFamily?: string; fontWeight?: string | number };

export type TAlign = 'left' | 'center' | 'right';
export type TVerticalAlign = 'top' | 'middle' | 'bottom';

const DEFAULT_FONT_FAMILY = 'system-ui, sans-serif';
const LINE_HEIGHT_RATIO = 1.25;

const fontString = ({ fontSize, fontFamily, fontWeight }: TFontSpec): string =>
    `${fontWeight ?? 'normal'} ${fontSize}px ${fontFamily ?? DEFAULT_FONT_FAMILY}`;

export const lineHeightFor = (fontSize: number): number => fontSize * LINE_HEIGHT_RATIO;

export const alignOffset = (align: TAlign | TVerticalAlign | undefined, size: number): number => {
    if (align === 'center' || align === 'middle') return size / 2;
    if (align === 'right' || align === 'bottom') return size;
    return 0;
};

export const measureTextWidth = (text: string, font: TFontSpec): number => {
    const ctx = getMeasureContext();
    if (ctx) {
        ctx.font = fontString(font);
        const w = ctx.measureText(text)?.width;
        if (typeof w === 'number' && w > 0) return w;
    }
    // average-glyph estimate keeps hit-testing working without a canvas (jsdom)
    return text.length * font.fontSize * 0.55;
};

export const wrapText = (text: string, maxWidth: number | undefined, font: TFontSpec): string[] => {
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
};

type TTextBlockOptions = TFontSpec & {
    x: number;
    y: number;
    color: string;
    align?: CanvasTextAlign;
    verticalAlign?: TVerticalAlign;
    lineHeight?: number;
    maxWidth?: number;
};

export const drawTextBlock = (ctx: CanvasRenderingContext2D, text: string, o: TTextBlockOptions): string[] => {
    const lines = wrapText(text, o.maxWidth, o);
    const lineHeight = o.lineHeight ?? lineHeightFor(o.fontSize);
    const top = o.y - alignOffset(o.verticalAlign, lines.length * lineHeight);
    ctx.font = fontString(o);
    ctx.fillStyle = o.color;
    ctx.textAlign = o.align ?? 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => ctx.fillText(line, o.x, top + lineHeight * (i + 0.5)));
    return lines;
};
