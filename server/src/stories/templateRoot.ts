import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEMPLATE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../template');
