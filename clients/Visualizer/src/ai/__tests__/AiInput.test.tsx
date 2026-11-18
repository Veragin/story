import '@story/shared';
import { observable } from 'mobx';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TAiStatus, TProjectDto } from '@story/protocol';
import { createMockApi, type TMockApi } from '../../api';
import {
    $,
    $$,
    get,
    mount,
    typeInto,
    unmount,
} from '../../components/inputs/__tests__/dom';
import { settle } from '../../stores/__tests__/mockStores';
import { AiInput } from '../AiInput';
import { AiStore } from '../AiStore';
import type { TPassageIndex } from '../PassageIndex';

describe('AiInput', () => {
    let api: TMockApi;
    let store: AiStore;

    const setState = (status: TAiStatus, credits = 10) =>
        act(() =>
            store.applyEvent({
                type: 'snapshot',
                status,
                credits,
                sessionId: null,
                messages: [],
                touchedFiles: [],
            })
        );

    const textarea = () =>
        get<HTMLTextAreaElement>('textarea[aria-label="Message"]');

    const press = (key: string, shiftKey = false, isComposing = false) => {
        const event = new KeyboardEvent('keydown', {
            key,
            shiftKey,
            isComposing,
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            textarea().dispatchEvent(event);
        });
        return event;
    };

    const pressEnter = (shiftKey = false) => press('Enter', shiftKey);

    const listbox = () => $('[role=listbox]');

    const selectedOptions = () =>
        $$('[role=option]').map((o) => o.getAttribute('aria-selected'));

    const optionLabels = () =>
        $$('[role=option] code').map((o) => o.textContent);

    const project: TProjectDto = {
        version: 'v1',
        chapters: [],
        characters: [{ id: 'thomas', name: 'Thomas' }],
        npcs: [],
        locations: [],
        items: [],
        triggers: [],
    };

    const withPassages = (overrides: Partial<TPassageIndex>) => {
        const passages: TPassageIndex = {
            passages: [],
            loading: false,
            inChapter: false,
            load: () => {},
            attachChapter: () => () => {},
            ...overrides,
        };
        store = new AiStore({ api, passages });
        setState('ready');
    };

    beforeEach(() => {
        api = createMockApi({ aiStepMs: 0 });
        const entities = observable({ project, start: () => () => {} });
        store = new AiStore({ api, entities });
        setState('ready');
    });

    afterEach(unmount);

    it('sends on Enter and keeps Shift+Enter for a newline', async () => {
        const send = vi.spyOn(api, 'sendAiMessage');
        mount(<AiInput store={store} />);
        typeInto(textarea(), 'Hello');

        const shifted = pressEnter(true);
        expect(shifted.defaultPrevented).toBe(false);
        expect(send).not.toHaveBeenCalled();

        const plain = pressEnter();
        expect(plain.defaultPrevented).toBe(true);
        expect(send).toHaveBeenCalledWith({ text: 'Hello' });
        await act(settle);
        expect(textarea().value).toBe('');
    });

    it('does not send an empty draft', () => {
        const send = vi.spyOn(api, 'sendAiMessage');
        mount(<AiInput store={store} />);
        typeInto(textarea(), '   ');
        pressEnter();
        expect(send).not.toHaveBeenCalled();
        expect(
            get<HTMLButtonElement>('button[aria-label="Send"]').disabled
        ).toBe(true);
    });

    it('is disabled while busy and offers a stop button that interrupts', () => {
        const interrupt = vi.spyOn(api, 'interruptAi');
        mount(<AiInput store={store} />);
        setState('busy');
        expect(textarea().disabled).toBe(true);
        expect($('button[aria-label="Send"]')).toBeNull();
        act(() => get('button[aria-label="Stop"]').click());
        expect(interrupt).toHaveBeenCalledTimes(1);
    });

    it('is disabled without credits', () => {
        mount(<AiInput store={store} />);
        setState('ready', 0);
        expect(textarea().disabled).toBe(true);
        expect(
            get<HTMLButtonElement>('button[aria-label="Send"]').disabled
        ).toBe(true);
    });

    it('hints the commands while the draft starts with a slash', () => {
        mount(<AiInput store={store} />);
        typeInto(textarea(), '/');
        expect(
            $$('[role=option]').map((o) => o.querySelector('code')?.textContent)
        ).toEqual(['/clear', '/resume [n]', '/cost', '/help']);
        typeInto(textarea(), '/re');
        const options = $$('[role=option]');
        expect(options).toHaveLength(1);
        act(() => options[0].click());
        expect(store.draft).toBe('/resume ');
        expect(document.activeElement).toBe(textarea());
        typeInto(textarea(), 'hello');
        expect($$('[role=option]')).toHaveLength(0);
    });

    it('follows the arrow keys with aria-selected and the active descendant', () => {
        mount(<AiInput store={store} />);
        typeInto(textarea(), '/');
        expect(listbox()?.getAttribute('aria-label')).toBe('Commands');
        expect(textarea().getAttribute('role')).toBe('combobox');
        expect(textarea().getAttribute('aria-expanded')).toBe('true');
        expect(textarea().getAttribute('aria-controls')).toBe(listbox()?.id);
        expect(selectedOptions()).toEqual(['false', 'false', 'false', 'false']);
        expect(textarea().getAttribute('aria-activedescendant')).toBeNull();

        press('ArrowDown');
        expect(selectedOptions()).toEqual(['true', 'false', 'false', 'false']);
        expect(textarea().getAttribute('aria-activedescendant')).toBe(
            $$('[role=option]')[0].id
        );
        press('ArrowUp');
        expect(selectedOptions()).toEqual(['false', 'false', 'false', 'true']);
        press('ArrowDown');
        expect(selectedOptions()).toEqual(['true', 'false', 'false', 'false']);
    });

    it('completes a command with Tab and sends a partial one with Enter', () => {
        const send = vi.spyOn(api, 'sendAiMessage');
        mount(<AiInput store={store} />);
        typeInto(textarea(), '/res');
        expect(press('Tab').defaultPrevented).toBe(true);
        expect(textarea().value).toBe('/resume ');
        expect(listbox()).toBeNull();

        typeInto(textarea(), '/res');
        pressEnter();
        expect(send).toHaveBeenCalledWith({ text: '/res' });
    });

    it('accepts an arrow selection with Enter without sending', () => {
        const send = vi.spyOn(api, 'sendAiMessage');
        mount(<AiInput store={store} />);
        typeInto(textarea(), '/res');
        press('ArrowDown');
        pressEnter();
        expect(textarea().value).toBe('/resume ');
        expect(send).not.toHaveBeenCalled();
    });

    it('sends a complete command on Enter', () => {
        const send = vi.spyOn(api, 'sendAiMessage');
        mount(<AiInput store={store} />);
        typeInto(textarea(), '/clear');
        pressEnter();
        expect(send).toHaveBeenCalledWith({ text: '/clear' });
    });

    it('completes reference classes and entries', () => {
        mount(<AiInput store={store} />);
        typeInto(textarea(), '@');
        expect(listbox()?.getAttribute('aria-label')).toBe('References');
        press('Tab');
        expect(textarea().value).toBe('@character:');
        expect(optionLabels()).toEqual(['thomas']);
        press('Tab');
        expect(textarea().value).toBe('@character:thomas ');
        expect(listbox()).toBeNull();

        typeInto(textarea(), '@ch');
        press('Tab');
        expect(textarea().value).toBe('@cha');
        expect(listbox()).not.toBeNull();
    });

    it('fills in the common prefix of the passages and stays open', () => {
        withPassages({
            passages: ['village-thomas-intro', 'village-thomas-forest'].map((id) => ({
                id,
                title: id,
                chapterId: 'village',
            })),
        });
        mount(<AiInput store={store} />);
        typeInto(textarea(), '@passage:vil');
        press('Tab');
        expect(textarea().value).toBe('@passage:village-thomas-');
        expect(optionLabels()).toEqual(['village-thomas-intro', 'village-thomas-forest']);
    });

    it('shows a loading row while the passages load', () => {
        withPassages({ loading: true });
        mount(<AiInput store={store} />);
        typeInto(textarea(), '@passage:');
        expect(listbox()?.textContent).toContain('Loading passages…');
    });

    it('hints a graph click while a passage reference is pending in a chapter', async () => {
        withPassages({ inChapter: true });
        await act(store.load);
        act(() => store.setOpen(true));
        setState('ready');
        mount(<AiInput store={store} />);
        typeInto(textarea(), '@passage:');
        expect(listbox()?.textContent).toContain('…or click a passage in the graph');
        typeInto(textarea(), '@npc:');
        expect(listbox()?.textContent).not.toContain('click a passage');
        act(() => store.setOpen(false));
    });

    it('picks a class with the arrows, then an entry with Tab', () => {
        mount(<AiInput store={store} />);
        typeInto(textarea(), '@');
        press('ArrowDown');
        press('ArrowDown');
        pressEnter();
        expect(textarea().value).toBe('@npc:');
        typeInto(textarea(), '@character:');
        press('Tab');
        expect(textarea().value).toBe('@character:thomas ');
    });

    it('sends a bare @ on Enter', () => {
        const send = vi.spyOn(api, 'sendAiMessage');
        mount(<AiInput store={store} />);
        typeInto(textarea(), '@');
        pressEnter();
        expect(send).toHaveBeenCalledWith({ text: '@' });
    });

    it('keeps an empty listbox open for a known class without entries, where Tab does nothing', () => {
        mount(<AiInput store={store} />);
        typeInto(textarea(), '@npc:');
        expect(listbox()).not.toBeNull();
        expect($$('[role=option]')).toHaveLength(0);
        expect(press('Tab').defaultPrevented).toBe(true);
        expect(textarea().value).toBe('@npc:');
    });

    it('resets the arrow selection when typing, so Enter sends again', () => {
        const send = vi.spyOn(api, 'sendAiMessage');
        mount(<AiInput store={store} />);
        typeInto(textarea(), '/');
        press('ArrowDown');
        typeInto(textarea(), '/c');
        expect(selectedOptions()).toEqual(['false', 'false']);
        pressEnter();
        expect(send).toHaveBeenCalledWith({ text: '/c' });
    });

    it('closes the dropdown on Escape without letting it bubble, then Enter sends', () => {
        const send = vi.spyOn(api, 'sendAiMessage');
        const outside = vi.fn();
        mount(<AiInput store={store} />);
        typeInto(textarea(), '/');
        press('ArrowDown');
        document.addEventListener('keydown', outside);
        press('Escape');
        expect(listbox()).toBeNull();
        expect(outside).not.toHaveBeenCalled();
        pressEnter();
        expect(send).toHaveBeenCalledWith({ text: '/' });
        document.removeEventListener('keydown', outside);
    });

    it('leaves the keys to the IME while composing', () => {
        mount(<AiInput store={store} />);
        typeInto(textarea(), '/res');
        expect(press('Tab', false, true).defaultPrevented).toBe(false);
        expect(textarea().value).toBe('/res');
    });
});
