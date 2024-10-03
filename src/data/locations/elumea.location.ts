import { TLocation } from 'types/TLocation';
import { hostinec_u_broduLocation } from './hostinec_u_brodu.location';

export const elumeaLocation: TLocation<'elumea'> = {
	id: 'elumea',
	name: _('Elumea'),
	description: 'Území v podzemí skládající se z několika stromů Elumů se svítícími kořeny.',
	
	localCharacters: [
	],

	sublocations: [
		hostinec_u_broduLocation,
	],

	init: {},
};

export type TElumeaLocationData = {
	void: void;
};
