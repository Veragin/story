import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const DEFAULT_QUALITY = 80;
const USAGE =
    'Usage: yarn to-webp [--quality <1-100>] [--lossless] <image> [<image> ...]';

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        quality: { type: 'string', short: 'q' },
        lossless: { type: 'boolean', default: false },
    },
});

const quality = Number(values.quality ?? DEFAULT_QUALITY);
if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
    console.error(`to-webp: quality must be an integer 1-100\n${USAGE}`);
    process.exit(1);
}
if (positionals.length === 0) {
    console.error(USAGE);
    process.exit(1);
}

const toWebpPath = (inputPath) => {
    const { dir, name } = path.parse(inputPath);
    return path.join(dir, `${name}.webp`);
};

const invocationDir = process.env.INIT_CWD ?? process.cwd();

const convert = async (inputArg) => {
    const inputPath = path.resolve(invocationDir, inputArg);
    const outputPath = toWebpPath(inputPath);
    if (outputPath === inputPath) {
        throw new Error('already a .webp file');
    }
    const info = await sharp(inputPath)
        .webp({ quality, lossless: values.lossless })
        .toFile(outputPath);
    console.log(
        `${inputArg} -> ${path.relative(invocationDir, outputPath)} (${info.size} bytes)`
    );
};

let failed = 0;
for (const inputPath of positionals) {
    try {
        await convert(inputPath);
    } catch (error) {
        failed++;
        console.error(`to-webp: ${inputPath}: ${error.message}`);
    }
}
process.exit(failed > 0 ? 1 : 0);
