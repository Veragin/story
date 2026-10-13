// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ApiEvents,
    createMockApi,
    createMockSeed,
    type TMockApi,
} from '../../../api';
import {
    $,
    $$,
    click,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import { settle } from '../../../stores/__tests__/mockStores';
import { TimelineStore } from '../store/TimelineStore';
import { TriggerModal } from '../TriggerModal';

const TRIGGER = 'nobleHouseRobbery';

describe('TriggerModal', () => {
    let api: TMockApi;
    let store: TimelineStore;
    let close: () => void;

    beforeEach(async () => {
        const seed = createMockSeed();
        seed.triggers = seed.triggers.map((t) => ({
            ...t,
            name: { code: "_('Robbery')" },
        }));
        const events = new ApiEvents({ createEventSource: undefined });
        api = createMockApi({ events, seed });
        store = new TimelineStore(api, events, {
            confirm: () => Promise.resolve(true),
            showReferences: vi.fn(),
            notify: vi.fn(),
            openChapter: vi.fn(),
        });
        await store.load();
        close = vi.fn();
        await mountAsync(
            <TriggerModal store={store} triggerId={TRIGGER} close={close} />
        );
    });

    afterEach(unmount);

    const save = async () => {
        const button = $$<HTMLButtonElement>('button').find(
            (b) => b.textContent === 'Save'
        );
        act(() => button?.click());
        await act(settle);
    };

    it('keeps a code name untouched while the description is edited', async () => {
        expect(
            get('[data-form-field="Name"] [data-code-value]').textContent
        ).toBe("_('Robbery')");
        typeInto(
            get<HTMLTextAreaElement>('textarea[data-field="description"]'),
            'At night'
        );
        await save();
        const saved = await api.getTrigger(TRIGGER);
        expect(saved.name).toEqual({ code: "_('Robbery')" });
        expect(saved.description).toBe('At night');
        expect(close).toHaveBeenCalled();
    });

    it('converts a code name to text and saves it', async () => {
        click('[data-form-field="Name"] [data-action="convert-to-value"]');
        expect($<HTMLInputElement>('input[data-field="name"]')?.value).toBe(
            'Robbery'
        );
        await save();
        expect((await api.getTrigger(TRIGGER)).name).toBe('Robbery');
    });
});
