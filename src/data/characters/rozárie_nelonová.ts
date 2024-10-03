
import { TCharacter } from 'types/TCharacter';

export const Rozárie_nelonová: TCharacter<'rozárie_nelonová'> = {
	id: 'rozárie_nelonová',
	name: _('Rozárie Nelonová'),
	startPassageId: undefined,
	
	init: {
		health: 100,
		hunger: 100,
		stamina: 100,
		inventory: [],
		location: undefined,
	},
};

export type TRozárie_nelonováCharacterData = {
	void: void;
};
