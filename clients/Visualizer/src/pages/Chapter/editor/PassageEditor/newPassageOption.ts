import { idFromTitle } from '../../../../idFromTitle';
import { idError } from '../../dialogUtils';
import type { TPassageCreator } from './types';

const localIdOf = (input: string, idPrefix: string) => {
    const local = input.startsWith(idPrefix) ? input.slice(idPrefix.length) : input;
    if (local === '') return null;
    return idError(local) === null ? local : idFromTitle(local, 'passage');
};

export const newPassageOption = (creator: TPassageCreator | undefined) => {
    if (!creator) return {};
    const { idPrefix, create } = creator;
    return {
        createFirst: true,
        createIdOf: (input: string) => {
            const local = localIdOf(input, idPrefix);
            return local === null ? null : idPrefix + local;
        },
        createLabel: (id: string) => _('+ %s', id),
        onCreateOption: (id: string) => create(id.slice(idPrefix.length)),
    };
};
