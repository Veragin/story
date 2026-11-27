const BRIGHT_LUMINANCE = 0.5;

const channelLuminance = (hex: string) => {
    const c = parseInt(hex, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = (color: string): number | undefined => {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(color);
    if (!m) return undefined;
    return 0.2126 * channelLuminance(m[1]) + 0.7152 * channelLuminance(m[2]) + 0.0722 * channelLuminance(m[3]);
};

export const isBrightColor = (color: string) => (relativeLuminance(color) ?? 0) > BRIGHT_LUMINANCE;

export const readableTextColor = (background: string) => (isBrightColor(background) ? '#000' : '#fff');
