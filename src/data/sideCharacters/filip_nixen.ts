
import { TSideCharacter } from 'types/TCharacter';

export const Filip_nixen: TSideCharacter<'filip_nixen'> = {
	id: 'filip_nixen',
	name: _('Filip Nixen'),
	description: '',
	
	init: {
		inventory: [],
		location: undefined,
	},
};

export type TFilip_nixenSideCharacterData = {
	void: void;
};
