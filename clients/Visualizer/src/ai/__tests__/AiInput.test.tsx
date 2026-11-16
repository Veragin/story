import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TAiStatus } from '@story/protocol';
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

    const pressEnter = (shiftKey = false) => {
        const event = new KeyboardEvent('keydown', {
            key: 'Enter',
            shiftKey,
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            textarea().dispatchEvent(event);
        });
        return event;
    };

    beforeEach(() => {
        api = createMockApi({ aiStepMs: 0 });
        store = new AiStore({ api });
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
        typeInto(textarea(), 'hello');
        expect($$('[role=option]')).toHaveLength(0);
    });
});
