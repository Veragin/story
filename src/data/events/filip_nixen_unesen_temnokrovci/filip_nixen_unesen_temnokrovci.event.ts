import { TEvent } from 'types/TEvent';
import { Time } from 'time/Time';
import { TEventPassage } from 'types/TPassage';

export const filip_nixen_unesen_temnokrovciEvent: TEvent<'filip_nixen_unesen_temnokrovci'> = {
	eventId: 'filip_nixen_unesen_temnokrovci',
	title: 'Filip_nixen_unesen_temnokrovci Event',
	description: '',
	timeRange: {
		start: Time.fromString('0.0 0:0'),
		end: Time.fromString('0.0 0:0'),
	},
	location: '',
	
	children: [],
	
	triggers: [],
	
	init: {},
};

export type TFilip_nixen_unesen_temnokrovciEventData = {
	void?: void;
};

export const filip_nixen_unesen_temnokrovciEventPassages = {
	
} as const;

// test
Object.values(filip_nixen_unesen_temnokrovciEventPassages).forEach((item: () => TEventPassage<'filip_nixen_unesen_temnokrovci'>) => void item);
