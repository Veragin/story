// @vitest-environment jsdom
import '@story/shared'; // installs the global `_`
import { act } from 'react';
import { runInAction } from 'mobx';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
    TLinearPassageDto,
    TPassageDto,
    TScreenPassageDto,
} from '@story/visualizer-protocol';
import { createMockApi, type TMockApi } from '../../../api';
import {
    $,
    click,
    get,
    flush,
    mountAsync,
    typeInto,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import { InStructure } from '../../../components/inputs/__tests__/harness';
import { PassageEditor } from '../editor/PassageEditor/PassageEditor';
import { PassageEditorStore } from '../editor/PassageEditorStore';

const ITEMS = [
    { id: 'bread', label: 'Bread' },
    { id: 'axe', label: 'Axe' },
];

const PASSAGES = [
    { id: 'village-thomas-intro' },
    { id: 'village-thomas-forest' },
];

const LINK = 'body.0.links.0';

describe('PassageEditor', () => {
    let api: TMockApi;
    let passages: TPassageDto[];
    let store: PassageEditorStore;

    beforeEach(async () => {
        sessionStorage.clear();
        api = createMockApi();
        passages = (await api.listChapterPassages('village')).passages;
    });

    afterEach(() => {
        unmount();
        store.destroy();
    });

    const open = async (passage: TPassageDto) => {
        store = new PassageEditorStore(passage, api);
        await mountAsync(
            <InStructure>
                <PassageEditor
                    store={store}
                    passageOptions={PASSAGES}
                    transitionOptions={[{ id: 'kingdom-thomas-visit' }]}
                    itemOptions={ITEMS}
                    onClose={() => undefined}
                    onDelete={() => undefined}
                    onEditSource={() => undefined}
                    api={api}
                />
            </InStructure>
        );
        await flush();
    };

    const passage = (id: string) => {
        const found = passages.find((p) => p.passageId === id);
        if (!found) throw new Error(`No passage ${id}`);
        return found;
    };

    const screen = (id: string): TScreenPassageDto => {
        const found = passage(id);
        if (found.type !== 'screen') throw new Error(`${id} is not a screen`);
        return found;
    };

    const draftLink = () => {
        const { draft } = store;
        if (draft.type !== 'screen' || !Array.isArray(draft.body))
            throw new Error('Not a screen with a body');
        const links = draft.body[0]?.links;
        return Array.isArray(links) ? links[0] : undefined;
    };

    const input = (field: string) =>
        get<HTMLInputElement>(`[data-field="${field}"]`);

    const inField = (label: string, selector: string) =>
        get(`[data-form-field="${label}"] ${selector}`);

    it('edits the title as text', async () => {
        await open(screen('village-thomas-intro'));
        expect(input('title').value).toBe('Intro');
        typeInto(input('title'), 'Start');
        expect(store.draft.type === 'screen' && store.draft.title).toBe(
            'Start'
        );
        expect(store.dirty).toBe(true);
    });

    it('shows a code title read-only and converts it', async () => {
        await open({
            ...screen('village-thomas-intro'),
            title: { code: "_('Hi')" },
        });
        expect($('[data-field="title"]')).toBeNull();
        expect(inField('Title', '[data-code-value]').textContent).toBe(
            "_('Hi')"
        );
        click('[data-form-field="Title"] [data-action="convert-to-value"]');
        expect(store.draft.type === 'screen' && store.draft.title).toBe('Hi');
    });

    it('edits a link: text, priority and the cost items', async () => {
        await open(screen('village-thomas-intro'));
        click('[data-action="toggle-link"]');
        expect(input(`${LINK}.text`).value).toBe('Lets go to the forest');
        expect(input(`${LINK}.autoPriortiy`).value).toBe('1');
        expect(get<HTMLInputElement>('[aria-label="Time (min)"]').value).toBe(
            '10'
        );

        typeInto(input(`${LINK}.autoPriortiy`), '3');
        expect(draftLink()?.autoPriortiy).toBe(3);

        click('[data-form-field="Items"] [data-action="add-field"]');
        click(`[data-field="${LINK}.cost.items"] [data-action="add-item"]`);
        expect(draftLink()?.cost).toEqual({
            time: { seconds: 600 },
            items: [{ id: 'bread', amount: 1 }],
        });

        typeInto(get<HTMLInputElement>('[aria-label="Item 1 amount"]'), '4');
        click('[data-form-field="Tools"] [data-action="add-field"]');
        click(`[data-field="${LINK}.cost.tools"] [data-action="add-item"]`);
        expect(draftLink()?.cost).toEqual({
            time: { seconds: 600 },
            items: [{ id: 'bread', amount: 4 }],
            tools: ['bread'],
        });
    });

    it('switches a time-only cost to minutes', async () => {
        await open(screen('village-thomas-intro'));
        click('[data-action="toggle-link"]');
        click('[data-form-field="Time (min)"] [data-action="remove-field"]');
        expect(draftLink()?.cost).toEqual({});
        click('[data-form-field="Cost"] [data-action="remove-field"]');
        expect(draftLink()?.cost).toBeUndefined();
        click('[data-form-field="Cost"] [data-action="add-field"]');
        expect(draftLink()?.cost).toEqual({ seconds: 600 });
        typeInto(get<HTMLInputElement>('[aria-label="Cost minutes"]'), '2');
        expect(draftLink()?.cost).toEqual({ seconds: 120 });
    });

    it('shows a code cost read-only and resets it', async () => {
        await open(screen('village-thomas-forest'));
        click('[data-action="toggle-link"]');
        expect(inField('Cost', '[data-code-value]').textContent).toContain(
            'DeltaTime.fromMin(1)'
        );
        expect(
            $('[data-form-field="Cost"] [data-action="convert-to-value"]')
        ).toBeNull();
        click('[data-form-field="Cost"] [data-action="reset-value"]');
        expect(draftLink()?.cost).toEqual({ seconds: 600 });
    });

    it('converts a code cost that is a plain cost object', async () => {
        const intro = screen('village-thomas-intro');
        await open({
            ...intro,
            body: [
                {
                    text: 'text',
                    links: [
                        {
                            text: 'Go',
                            passageId: 'village-thomas-forest',
                            cost: {
                                code: "{ time: DeltaTime.fromMin(5), tools: ['axe'] }",
                            },
                        },
                    ],
                },
            ],
        });
        click('[data-action="toggle-link"]');
        click('[data-form-field="Cost"] [data-action="convert-to-value"]');
        expect(draftLink()?.cost).toEqual({
            time: { seconds: 300 },
            tools: ['axe'],
        });
    });

    it('shows diagnostics at their field and opens the link', async () => {
        await open(screen('village-thomas-intro'));
        act(() =>
            runInAction(() => {
                store.diagnostics = [
                    {
                        file: 'intro.ts',
                        line: 1,
                        column: 1,
                        message: 'Unknown item',
                        field: `${LINK}.cost.items.0.id`,
                    },
                ];
            })
        );
        expect(inField('Items', '').textContent).toContain('Unknown item');
        expect(inField('Tools', '').textContent).not.toContain('Unknown item');
    });

    it('adds the next passage of a linear passage but does not remove it', async () => {
        const linear: TLinearPassageDto = {
            ...screen('village-thomas-intro'),
            type: 'linear',
            description: 'Walking',
        };
        await open(linear);
        expect(input('description').value).toBe('Walking');
        click('[data-form-field="Next passage"] [data-action="add-field"]');
        expect(store.draft.type === 'linear' && store.draft.nextPassageId).toBe(
            'village-thomas-intro'
        );
        expect(
            $('[data-form-field="Next passage"] [data-action="remove-field"]')
        ).toBeNull();
    });

    it('offers the passages of other chapters as a transition target', async () => {
        await open(passage('village-thomas-cool'));
        const target = input('nextPassageId');
        expect(target.value).toBe('village-thomas-');
        expect(
            inField('Next passage (another chapter)', '').textContent
        ).toContain('Not one of the options');
    });
});
