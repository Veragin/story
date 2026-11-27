import sharp from 'sharp';

export type TSolidImageFormat = 'png' | 'jpeg' | 'webp';

// a real, decodable image of one colour
export const solidImage = async (
    format: TSolidImageFormat,
    { width = 16, height = 16 }: { width?: number; height?: number } = {}
): Promise<Buffer> =>
    await sharp({ create: { width, height, channels: 3, background: { r: 200, g: 60, b: 40 } } })
        .toFormat(format)
        .toBuffer();
