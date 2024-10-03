import { TRace } from "types/TCharacter";

export const races: Record<string, TRace> = {
	human: {
        name: _('Human'),
        description: _(''),
    },
    elf: {
        name: _('Elf'),
        description: _('A humanoid craeture with long ears and a long life span.'),
    },
    dwarf: {
        name: _('Dwarf'),
        description: _('A short humanoid creature with a long beard.'),
    },
};