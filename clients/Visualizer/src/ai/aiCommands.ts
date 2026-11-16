export type TAiCommand = {
    name: string;
    usage: string;
    description: () => string;
};

export const AI_COMMANDS: readonly TAiCommand[] = [
    { name: '/clear', usage: '/clear', description: () => _('Start a new conversation') },
    {
        name: '/resume',
        usage: '/resume [n]',
        description: () => _('List the recent conversations, or continue number n'),
    },
    { name: '/cost', usage: '/cost', description: () => _('Show the credits left and the tokens used') },
    { name: '/help', usage: '/help', description: () => _('List the commands') },
];

export const matchingCommands = (draft: string): TAiCommand[] => {
    if (!draft.startsWith('/')) return [];
    const typed = draft.split(/\s/)[0];
    return AI_COMMANDS.filter((command) => command.name.startsWith(typed));
};

export const commandHelp = (): string =>
    AI_COMMANDS.map((command) => `${command.usage} · ${command.description()}`).join('\n');
