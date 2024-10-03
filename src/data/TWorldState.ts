import { TRozárie_nelonováCharacterData } from './characters/rozárie_nelonová';
import { TDaniel_benCharacterData } from './characters/daniel_ben';
import { TFelix_standhopeCharacterData } from './characters/felix_standhope';
import { TFilip_nixenSideCharacterData } from './sideCharacters/filip_nixen';
import { TEl_ne_arLocationData } from './locations/el_ne_ar.location';
import { THostinec_u_broduLocationData } from './locations/hostinec_u_brodu.location';
import { TElumeaLocationData } from './locations/elumea.location';
import { TArkaLocationData } from './locations/arka.location';
import { TFilip_nixen_unesen_temnokrovciEventData } from './events/filip_nixen_unesen_temnokrovci/filip_nixen_unesen_temnokrovci.event';

import { TCharacterId } from 'types/TIds';
import { THistoryItem } from 'code/Engine/ts/History';
import { TEvent } from 'types/TEvent';
import { TLocation } from 'types/TLocation';
import { TCharacter, TCharacterData, TSideCharacter, TSideCharacterData } from 'types/TCharacter';


export type TWorldState = {
    time: Time;
    mainCharacterId: TCharacterId;
    currentHistory: Partial<Record<TCharacterId, THistoryItem>>;

    characters: {
    	felix_standhope: { ref: TCharacter<'felix_standhope'> } & TCharacterData & Partial<TFelix_standhopeCharacterData>;
    	daniel_ben: { ref: TCharacter<'daniel_ben'> } & TCharacterData & Partial<TDaniel_benCharacterData>;
    	rozárie_nelonová: { ref: TCharacter<'rozárie_nelonová'> } & TCharacterData & Partial<TRozárie_nelonováCharacterData>;
    };
    sideCharacters: {
    	filip_nixen: { ref: TSideCharacter<'filip_nixen'> } & TSideCharacterData & Partial<TFilip_nixenSideCharacterData>;
    };
    events: {
    	filip_nixen_unesen_temnokrovci: { ref: TEvent<'filip_nixen_unesen_temnokrovci'> } & Partial<TFilip_nixen_unesen_temnokrovciEventData>;
    };
    locations: {
    	arka: { ref: TLocation<'arka'> } & Partial<TArkaLocationData>;
    	elumea: { ref: TLocation<'elumea'> } & Partial<TElumeaLocationData>;
    	hostinec_u_brodu: { ref: TLocation<'hostinec_u_brodu'> } & Partial<THostinec_u_broduLocationData>;
    	el_ne_ar: { ref: TLocation<'el_ne_ar'> } & Partial<TEl_ne_arLocationData>;
    };
};