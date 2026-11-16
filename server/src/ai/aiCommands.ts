export type TAiCommand =
    | { kind: 'clear' }
    | { kind: 'resume'; index: number | null }
    | { kind: 'cost' }
    | { kind: 'help' }
    | { kind: 'invalid'; message: string }
    | { kind: 'prompt'; text: string };

export const AI_COMMAND_HELP: readonly (readonly [string, string])[] = [
    ['/clear', 'start a new conversation'],
    ['/resume', 'list the recent conversations'],
    ['/resume <n>', 'continue conversation n of that list'],
    ['/cost', 'credits left and the tokens of this conversation'],
    ['/help', 'this list'],
];

const COMMAND = /^\/([a-z-]+)(?:\s+(.*))?$/s;

// unknown slash commands are the skills' own and go to the CLI
export const parseAiCommand = (input: string): TAiCommand => {
    const text = input.trim();
    const match = COMMAND.exec(text);
    if (!match) return { kind: 'prompt', text };
    const [, name, rest = ''] = match;
    const argument = rest.trim();
    const noArgument = (command: TAiCommand): TAiCommand =>
        argument === '' ? command : { kind: 'invalid', message: `/${name} takes no argument` };
    switch (name) {
        case 'clear':
            return noArgument({ kind: 'clear' });
        case 'cost':
            return noArgument({ kind: 'cost' });
        case 'help':
            return noArgument({ kind: 'help' });
        case 'resume': {
            if (argument === '') return { kind: 'resume', index: null };
            const index = /^\d+$/.test(argument) ? Number(argument) : 0;
            return index >= 1
                ? { kind: 'resume', index }
                : { kind: 'invalid', message: 'Use /resume <n> with n from the /resume list' };
        }
        default:
            return { kind: 'prompt', text };
    }
};

export const helpText = (): string =>
    ['Commands:', ...AI_COMMAND_HELP.map(([command, meaning]) => `${command} — ${meaning}`)].join('\n');
