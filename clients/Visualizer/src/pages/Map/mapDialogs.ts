import { createElement } from 'react';
import { modals } from '../../shell';
import { DeleteLocationDialog } from './DeleteLocationDialog';
import { MapSizeDialog } from './MapSizeDialog';
import type { TDeleteLocationChoice, TDeleteLocationRequest, TMapSize } from './MapPageStore';

export const askMapSize = (locationName: string) =>
    modals.ask<TMapSize | null>((onAnswer) => createElement(MapSizeDialog, { locationName, onAnswer }), null);

export const askDeleteLocation = (request: TDeleteLocationRequest) =>
    modals.ask<TDeleteLocationChoice | null>(
        (onAnswer) => createElement(DeleteLocationDialog, { request, onAnswer }),
        null
    );
