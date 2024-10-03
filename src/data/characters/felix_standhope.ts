import { TCharacter } from 'types/TCharacter';

export const Felix_standhope: TCharacter<'felix_standhope'> = {
	id: 'felix_standhope',
	name: _('felix_standhope'),
	startPassageId: undefined,
	
	init: {
		health: 100,
		hunger: 100,
		stamina: 100,
		inventory: [],
		location: undefined,
	},
};

export type TFelix_standhopeCharacterData = {
	void: void;
};
