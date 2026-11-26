import { describe, expect, it } from 'vitest';
import { bulletListEdit, type TTextSelection } from '../bulletList';

const CARET = '|';

const at = (marked: string): TTextSelection => {
    const start = marked.indexOf(CARET);
    const end = marked.lastIndexOf(CARET);
    const value = marked.split(CARET).join('');
    return {
        value,
        selectionStart: start,
        selectionEnd: start === end ? start : end - 1,
    };
};

const press = (marked: string, key: string, shiftKey = false) =>
    bulletListEdit(at(marked), {
        key,
        shiftKey,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
    });

describe('bulletListEdit', () => {
    it('turns a leading star into a bullet on space', () => {
        expect(press('intro\n*|', ' ')).toEqual(at('intro\n• |'));
        expect(press('  *|', ' ')).toEqual(at('  • |'));
    });

    it('leaves a star that is not alone at the line start', () => {
        expect(press('a *|', ' ')).toBeNull();
        expect(press('**|', ' ')).toBeNull();
    });

    it('continues the list on Enter, keeping the level', () => {
        expect(press('• one|', 'Enter')).toEqual(at('• one\n• |'));
        expect(press('  • one|\nrest', 'Enter')).toEqual(at('  • one\n  • |\nrest'));
        expect(press('• on|e', 'Enter')).toEqual(at('• on\n• |e'));
    });

    it('ends the list on Enter in an empty item', () => {
        expect(press('• one\n  • |', 'Enter')).toEqual(at('• one\n|'));
    });

    it('keeps a plain Enter outside a list or with Shift', () => {
        expect(press('one|', 'Enter')).toBeNull();
        expect(press('• one|', 'Enter', true)).toBeNull();
    });

    it('removes the bullet on Backspace right after it', () => {
        expect(press('a\n  • |text', 'Backspace')).toEqual(at('a\n|text'));
        expect(press('• t|ext', 'Backspace')).toBeNull();
    });

    it('indents and outdents bullets with Tab', () => {
        expect(press('• o|ne', 'Tab')).toEqual(at('  • o|ne'));
        expect(press('    • o|ne', 'Tab', true)).toEqual(at('  • o|ne'));
        expect(press(' • o|ne', 'Tab', true)).toEqual(at('• o|ne'));
        expect(press('• o|ne', 'Tab', true)).toEqual(at('• o|ne'));
    });

    it('indents every bullet in the selection', () => {
        expect(press('• |a\nplain\n• b|', 'Tab')).toEqual(at('  • |a\nplain\n  • b|'));
    });

    it('leaves Tab alone outside a list', () => {
        expect(press('plain|', 'Tab')).toBeNull();
    });
});
