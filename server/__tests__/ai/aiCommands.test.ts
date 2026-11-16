import { describe, expect, it } from 'vitest';
import { helpText, parseAiCommand } from '../../src/ai/aiCommands';

describe('AI commands', () => {
    it('parses the server commands', () => {
        expect(parseAiCommand('/clear')).toEqual({ kind: 'clear' });
        expect(parseAiCommand(' /cost ')).toEqual({ kind: 'cost' });
        expect(parseAiCommand('/help')).toEqual({ kind: 'help' });
        expect(parseAiCommand('/resume')).toEqual({ kind: 'resume', index: null });
        expect(parseAiCommand('/resume 3')).toEqual({ kind: 'resume', index: 3 });
    });

    it('rejects bad arguments', () => {
        expect(parseAiCommand('/resume 0')).toMatchObject({ kind: 'invalid' });
        expect(parseAiCommand('/resume two')).toMatchObject({ kind: 'invalid' });
        expect(parseAiCommand('/clear now')).toEqual({ kind: 'invalid', message: '/clear takes no argument' });
    });

    it('passes prompts and skill commands through', () => {
        expect(parseAiCommand('  rename the village ')).toEqual({ kind: 'prompt', text: 'rename the village' });
        expect(parseAiCommand('/passages add a well')).toEqual({ kind: 'prompt', text: '/passages add a well' });
        expect(parseAiCommand('/ clear')).toEqual({ kind: 'prompt', text: '/ clear' });
        expect(parseAiCommand('/resume\n2')).toEqual({ kind: 'resume', index: 2 });
    });

    it('lists every command in the help', () => {
        expect(helpText()).toContain('/resume <n>');
        expect(helpText().split('\n')).toHaveLength(6);
    });
});
