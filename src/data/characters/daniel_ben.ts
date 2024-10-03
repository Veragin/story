
import { TCharacter } from 'types/TCharacter';

export const Daniel_ben: TCharacter<'daniel_ben'> = {
	id: 'daniel_ben',
	name: _('Daniel Ben)'),
	startPassageId: undefined,
	
	init: {
		health: 100,
		hunger: 100,
		stamina: 100,
		inventory: [],
		location: undefined,
	},
};

export type TDaniel_benCharacterData = {
	void: void;
};
