import { Rozárie_nelonová } from './characters/rozárie_nelonová';
import { Daniel_ben } from './characters/daniel_ben';
import { Felix_standhope } from './characters/felix_standhope';
import { Filip_nixen } from './sideCharacters/filip_nixen';
import { el_ne_arLocation } from './locations/el_ne_ar.location';
import { hostinec_u_broduLocation } from './locations/hostinec_u_brodu.location';
import { elumeaLocation } from './locations/elumea.location';
import { arkaLocation } from './locations/arka.location';
import { filip_nixen_unesen_temnokrovciEvent, filip_nixen_unesen_temnokrovciEventPassages } from './events/filip_nixen_unesen_temnokrovci/filip_nixen_unesen_temnokrovci.event';

export const register = {
    characters: {
    	felix_standhope: Felix_standhope,
    	daniel_ben: Daniel_ben,
    	rozárie_nelonová: Rozárie_nelonová,
    },
    sideCharacters: {
    	filip_nixen: Filip_nixen,
    	felix_standohpe: Felix_standhope,
    },
    events: {
    	filip_nixen_unesen_temnokrovci: filip_nixen_unesen_temnokrovciEvent,
    },
    locations: {
    	arka: arkaLocation,
    	elumea: elumeaLocation,
    	hostinec_u_brodu: hostinec_u_broduLocation,
    	el_ne_ar: el_ne_arLocation,
    },
    passages: {
    	...filip_nixen_unesen_temnokrovciEventPassages,
    },
} as const;
