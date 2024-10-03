import { TLocation } from 'types/TLocation';

export const arkaLocation: TLocation<'arka'> = {
	id: 'arka',
	name: _('Arka'),
	description: '',
	
	localCharacters: [
	],

	init: {},
};

export type TArkaLocationData = {
	void: void;
};
