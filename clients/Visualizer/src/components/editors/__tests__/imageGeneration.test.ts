import '@story/shared';
import { describe, expect, it } from 'vitest';
import { generateBlockReason } from '../imageGeneration';

const PASSAGE_FILE = 'data/chapters/village/thomas.passages/forest.ts';
const EMPTY = 'Write a description of the picture first.';
const LINKED = 'This passage shows a linked image. Replace the link with a description to generate one.';
const CODE = 'Convert the description to text first.';

describe('generateBlockReason', () => {
    it('blocks an empty or blank description', () => {
        expect(generateBlockReason(undefined, undefined)).toBe(EMPTY);
        expect(generateBlockReason('', undefined)).toBe(EMPTY);
        expect(generateBlockReason(' \n\t', PASSAGE_FILE)).toBe(EMPTY);
    });

    it('blocks an image link of a passage only', () => {
        expect(generateBlockReason('@intro.png', PASSAGE_FILE)).toBe(LINKED);
        expect(generateBlockReason('  @../annie.passages/palace.png', PASSAGE_FILE)).toBeNull();
        expect(generateBlockReason('@thomas in the rain', undefined)).toBeNull();
    });

    it('blocks code', () => {
        expect(generateBlockReason({ code: "_('Thomas')" }, undefined)).toBe(CODE);
    });

    it('lets plain text and mentions through', () => {
        expect(generateBlockReason('Thomas at the well', PASSAGE_FILE)).toBeNull();
        expect(generateBlockReason('@character:thomas in @location:village', PASSAGE_FILE)).toBeNull();
    });
});
