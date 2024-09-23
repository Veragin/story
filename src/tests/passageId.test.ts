import { parsePassageId } from 'code/utils/parsePassageId';
import { register } from '../data/register';
import { TPassageId } from 'types/TIds';

describe('checks if passage registerd under passageId has correct ids inside', () => {
    it.each(Object.keys(register.passages) as TPassageId[])('passageId: %s', (passageId) => {
        const { characterId, eventId, id } = parsePassageId(passageId);
        const passage = register.passages[passageId]();

        expect(passage.characterId).toBe(characterId);
        expect(passage.eventId).toBe(eventId);
        expect(passage.id).toBe(id);
    });
});
