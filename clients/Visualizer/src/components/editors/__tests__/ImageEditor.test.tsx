import '@story/shared'; // installs the global `_`
import {
    $,
    $$,
    click,
    flush,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../inputs/__tests__/dom';
import { act, useState, type ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TImageDto, TMaybeCode, TProjectDto } from '@story/protocol';
import {
    createMockApi,
    type TMockApi,
    type TStoryImageFile,
    type TVisualizerApi,
} from '../../../api';
import type { TMentionStores } from '../../../ai/aiMentions';
import { AiStore } from '../../../ai/AiStore';
import { modals } from '../../../shell/modals';
import { ImageEditor } from '../ImageEditor';

const image = (url: string | null): TImageDto => ({
    owner: 'characters',
    id: 'annie',
    file: 'data/characters/annie.png',
    version: url ? 'v1' : '',
    url,
});

const fakeApi = (dto: TImageDto, files: TStoryImageFile[] = []) =>
    ({
        getImage: vi.fn(() => Promise.resolve(dto)),
        uploadImage: vi.fn(),
        listImageFiles: vi.fn(() => Promise.resolve(files)),
    }) as unknown as TVisualizerApi;

const PROJECT: TProjectDto = {
    version: 'v1',
    chapters: [],
    characters: [{ id: 'thomas', name: 'Thomas' }],
    npcs: [],
    locations: [{ id: 'village', name: 'Village' }],
    items: [],
    triggers: [],
};

const testMentions = (): TMentionStores => ({
    entities: { project: PROJECT, start: vi.fn(() => () => {}) },
    passages: {
        passages: [
            {
                id: 'village-thomas-intro',
                title: 'Intro',
                chapterId: 'village',
            },
        ],
        loading: false,
        inChapter: false,
        load: vi.fn(),
    },
});

const DESCRIPTION = '[data-field="image-description"]';

const description = () => get<HTMLTextAreaElement>(DESCRIPTION);

const options = () =>
    $$('[data-option]').map((li) => li.getAttribute('data-option'));

// React reads the caret on `input`: set the value, then the caret, then fire
const typeAt = (el: HTMLTextAreaElement, value: string, caret: number) => {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value'
    )?.set;
    act(() => {
        el.focus();
        setter?.call(el, value);
        el.setSelectionRange(caret, caret);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
};

const key = (k: string) =>
    act(() => {
        description().dispatchEvent(
            new KeyboardEvent('keydown', { key: k, bubbles: true })
        );
    });

type TEditorProps = ComponentProps<typeof ImageEditor>;

const Editable = ({
    initial,
    onChange,
    ...props
}: Omit<TEditorProps, 'value' | 'onChange' | 'ariaLabel'> & {
    initial: string;
    onChange: (value: string) => void;
}) => {
    const [value, setValue] = useState(initial);
    return (
        <ImageEditor
            {...props}
            value={value}
            onChange={(next) => {
                setValue(next);
                onChange(next);
            }}
            ariaLabel="Image"
        />
    );
};

describe('ImageEditor', () => {
    afterEach(unmount);

    const render = async (
        dto: TImageDto,
        description: TMaybeCode<string> | undefined,
        onDescriptionChange = vi.fn()
    ) => {
        await mountAsync(
            <ImageEditor
                api={fakeApi(dto)}
                owner="characters"
                id="annie"
                value={description}
                onChange={onDescriptionChange}
                ariaLabel="Image"
                mentions={testMentions()}
            />
        );
        return onDescriptionChange;
    };

    const TEXTAREA = '[data-field="image-description"]';
    const textarea = () => $<HTMLTextAreaElement>(TEXTAREA);

    it('shows the image beside the description, with download, upload and delete', async () => {
        await render(image('data:image/png;base64,AAAA'), 'Annie at the well');
        const img = get<HTMLImageElement>('img');
        expect(img.getAttribute('src')).toBe('data:image/png;base64,AAAA');
        expect(img.getAttribute('alt')).toBe('Annie at the well');
        expect(get<HTMLTextAreaElement>(TEXTAREA).value).toBe(
            'Annie at the well'
        );
        expect($('[data-action="download-image"]')).not.toBeNull();
        expect($('[data-action="upload-image"]')).not.toBeNull();
        expect($('[data-action="remove-image"]')).not.toBeNull();
    });

    it('shows the description and an upload button without an image', async () => {
        await render(image(null), undefined);
        expect($('img')).toBeNull();
        expect(get<HTMLTextAreaElement>(TEXTAREA).value).toBe('');
        expect(
            get<HTMLTextAreaElement>(TEXTAREA).getAttribute('placeholder')
        ).toBe('What the picture shows');
        const upload = get<HTMLButtonElement>('[data-action="upload-image"]');
        expect(upload.disabled).toBe(false);
        expect(upload.textContent).toBe('');
        expect($('[data-action="download-image"]')).toBeNull();
        expect($('[data-action="remove-image"]')).toBeNull();
        expect(document.body.textContent).not.toContain('PNG');
    });

    it('reports a description change', async () => {
        const onChange = await render(image(null), 'old');
        typeInto(get<HTMLTextAreaElement>(TEXTAREA), 'A portrait of Annie');
        expect(onChange).toHaveBeenCalledWith('A portrait of Annie');
    });

    it('shows a code description read-only, with convert to text', async () => {
        const onChange = await render(image(null), {
            code: "'Annie at the ' + place",
        });
        expect(textarea()).toBeNull();
        expect(document.body.textContent).toContain("'Annie at the ' + place");
        click('[data-action="convert-to-value"]');
        expect(onChange).toHaveBeenCalledWith("'Annie at the ' + place");
    });

    it('has no description without onChange', async () => {
        await mountAsync(
            <ImageEditor
                api={fakeApi(image('data:image/png;base64,AAAA'))}
                owner="characters"
                id="annie"
                ariaLabel="Image"
            />
        );
        expect(textarea()).toBeNull();
        expect($('[data-action="remove-image"]')).not.toBeNull();
        unmount();
        await mountAsync(
            <ImageEditor
                api={fakeApi(image(null))}
                owner="characters"
                id="annie"
                ariaLabel="Image"
            />
        );
        expect(textarea()).toBeNull();
        expect($('[data-action="upload-image"]')).not.toBeNull();
    });

    it('converts code that is not a plain string to its source text', async () => {
        const onChange = await render(image('data:image/png;base64,AAAA'), {
            code: 's.name + "!"',
        });
        click('[data-action="convert-to-value"]');
        expect(onChange).toHaveBeenCalledWith('s.name + "!"');
    });
});

describe('ImageEditor image links', () => {
    afterEach(unmount);

    const PASSAGE_FILE = 'data/chapters/village/thomas.passages/forest.ts';
    const INTRO = 'data/chapters/village/thomas.passages/intro.png';
    const PALACE = 'data/chapters/kingdom/annie.passages/palace.png';
    const FILES: TStoryImageFile[] = [
        { file: INTRO, url: 'intro-url' },
        { file: PALACE, url: 'palace-url' },
    ];
    const passageImage: TImageDto = {
        owner: 'passages',
        id: 'village-thomas-forest',
        file: 'data/chapters/village/thomas.passages/forest.png',
        version: '',
        url: null,
    };

    const render = async (initial: string, onChange = vi.fn()) => {
        await mountAsync(
            <Editable
                initial={initial}
                onChange={onChange}
                api={fakeApi(passageImage, FILES)}
                owner="passages"
                id="village-thomas-forest"
                linkFrom={PASSAGE_FILE}
                mentions={testMentions()}
            />
        );
        await flush();
        return onChange;
    };

    it('shows the linked image with download and upload, but no delete', async () => {
        await render('@intro.png');
        const img = get<HTMLImageElement>(`[data-linked-image="${INTRO}"]`);
        expect(img.getAttribute('src')).toBe('intro-url');
        expect($('[data-action="download-image"]')).not.toBeNull();
        expect($('[data-action="upload-image"]')).not.toBeNull();
        expect($('[data-action="remove-image"]')).toBeNull();
        expect(description().value).toBe('@intro.png');
    });

    it('resolves a link that leaves the passage folder', async () => {
        await render('@../../kingdom/annie.passages/palace.png');
        expect($(`[data-linked-image="${PALACE}"]`)).not.toBeNull();
    });

    it('reports a link to a missing image', async () => {
        await render('@nowhere.png');
        expect($('[data-linked-image="missing"]')?.textContent).toContain(
            'nowhere.png'
        );
        expect($('[data-action="download-image"]')).toBeNull();
    });

    it('hints image paths relative to the passage only after @', async () => {
        await render('');
        typeInto(description(), 'A misty forest');
        expect(options()).toEqual([]);

        typeInto(description(), '@');
        expect(document.activeElement).toBe(description());
        expect(options()).toEqual([
            '@character:',
            '@npc:',
            '@location:',
            '@item:',
            '@chapter:',
            '@passage:',
            '@intro.png',
            '@../../kingdom/annie.passages/palace.png',
        ]);

        typeInto(description(), '@pal');
        expect(options()).toEqual(['@../../kingdom/annie.passages/palace.png']);
    });

    it('shows no image while the link is only @', async () => {
        await render('@');
        expect($('[data-linked-image]')).toBeNull();
        expect($('[data-action="upload-image"]')).not.toBeNull();
    });

    it('offers no paths for a mention or after the start', async () => {
        await render('');
        typeInto(description(), '@character:');
        expect(options()).toEqual(['@character:thomas']);

        typeInto(description(), 'In the forest @');
        expect(options()).not.toContain('@intro.png');
        expect(options()).toContain('@character:');
    });

    it('picks the highlighted hint with the keyboard', async () => {
        const onChange = await render('');
        typeInto(description(), '@');
        key('ArrowUp');
        key('Enter');
        expect(onChange).toHaveBeenLastCalledWith(
            '@../../kingdom/annie.passages/palace.png'
        );
        expect(options()).toEqual([]);
    });

    it('links the picked image', async () => {
        const onChange = await render('');
        typeInto(description(), '@pal');
        click('[data-option="@../../kingdom/annie.passages/palace.png"]');
        expect(onChange).toHaveBeenLastCalledWith(
            '@../../kingdom/annie.passages/palace.png'
        );
        expect($(`[data-linked-image="${PALACE}"]`)).not.toBeNull();
    });
});

describe('ImageEditor mentions', () => {
    afterEach(unmount);

    const render = async (initial: string, mentions = testMentions()) => {
        const onChange = vi.fn();
        await mountAsync(
            <Editable
                initial={initial}
                onChange={onChange}
                api={fakeApi(image(null))}
                owner="characters"
                id="annie"
                mentions={mentions}
            />
        );
        return { onChange, mentions };
    };

    it('suggests mention classes, then entries, at the cursor in the middle of a description', async () => {
        const { onChange, mentions } = await render('');
        expect(mentions.entities.start).not.toHaveBeenCalled();

        typeAt(description(), 'Annie and @ at the well', 11);
        expect(options()).toContain('@character:');
        expect(options()).not.toContain('@intro.png');
        expect(mentions.entities.start).toHaveBeenCalledTimes(1);

        click('[data-option="@character:"]');
        expect(onChange).toHaveBeenLastCalledWith(
            'Annie and @character: at the well'
        );
        expect(description().selectionStart).toBe(21);
        expect(options()).toEqual(['@character:thomas']);

        key('Enter');
        expect(onChange).toHaveBeenLastCalledWith(
            'Annie and @character:thomas at the well'
        );
        expect(description().selectionStart).toBe(27);
        expect(options()).toEqual([]);
    });

    it('adds a space after a mention picked at the end', async () => {
        const { onChange } = await render('');
        typeInto(description(), 'Thomas in @location:vi');
        click('[data-option="@location:village"]');
        expect(onChange).toHaveBeenLastCalledWith(
            'Thomas in @location:village '
        );
    });

    it('lists the passages for @passage: and loads them', async () => {
        const { mentions } = await render('');
        typeInto(description(), 'As in @passage:');
        expect(options()).toEqual(['@passage:village-thomas-intro']);
        expect(mentions.passages.load).toHaveBeenCalled();
    });

    it('shows mentions by name in the image alt', async () => {
        await mountAsync(
            <ImageEditor
                api={fakeApi(image('data:image/png;base64,AAAA'))}
                owner="characters"
                id="annie"
                value="Annie with @character:thomas in @location:nowhere"
                onChange={vi.fn()}
                ariaLabel="Image"
                mentions={testMentions()}
            />
        );
        expect(get<HTMLImageElement>('img').getAttribute('alt')).toBe(
            'Annie with Thomas in nowhere'
        );
    });
});

describe('ImageEditor generation', () => {
    let api: TMockApi;

    afterEach(() => {
        act(() => modals.closeAll());
        vi.restoreAllMocks();
        unmount();
    });

    const setup = async (options: Parameters<typeof createMockApi>[0] = {}) => {
        api = createMockApi({ aiCredits: 10, aiStepMs: 0, ...options });
        const ai = new AiStore({ api });
        await ai.load();
        const info = { info: await api.getStoryInfo() };
        return { ai, info };
    };

    const render = async (
        initial: string,
        props: Partial<TEditorProps> = {}
    ) => {
        const { ai, info } = await setup();
        const onImageChange = vi.fn();
        await mountAsync(
            <Editable
                initial={initial}
                onChange={vi.fn()}
                api={api}
                owner="characters"
                id="thomas"
                ai={ai}
                info={info}
                mentions={testMentions()}
                onImageChange={onImageChange}
                {...props}
            />
        );
        await flush();
        return { ai, onImageChange };
    };

    const GENERATE = '[data-action="generate-image"]';
    const generateButton = () => get<HTMLButtonElement>(GENERATE);
    const errorText = () => document.body.textContent ?? '';

    const generated = async () => {
        await vi.waitFor(() =>
            expect($<HTMLImageElement>('img')?.getAttribute('src')).toMatch(
                /^data:image\/webp;base64,UklGR/
            )
        );
        await flush();
    };

    it('generates the image from the draft description, charges credits and stores it', async () => {
        const { ai, onImageChange } = await render('Thomas waving');
        const generate = vi.spyOn(api, 'generateImage');
        click(GENERATE);
        expect(generate).toHaveBeenCalledWith('characters', 'thomas', {
            prompt: 'Thomas waving',
            version: '',
        });
        await generated();
        expect(ai.credits).toBe(6);
        expect(onImageChange).toHaveBeenCalledWith(
            expect.not.objectContaining({ credits: expect.anything() })
        );
        const stored = await api.getImage('characters', 'thomas');
        expect(stored.file).toBe('data/characters/thomas.webp');
        expect(stored.version).not.toBe('');
        expect(get<HTMLImageElement>('img').getAttribute('src')).toBe(
            stored.url
        );
    });

    it('asks before replacing an existing image', async () => {
        await render('Thomas waving');
        click(GENERATE);
        await generated();
        const first = await api.getImage('characters', 'thomas');

        const confirm = vi.spyOn(modals, 'confirm').mockResolvedValue(false);
        const generate = vi.spyOn(api, 'generateImage');
        click(GENERATE);
        await flush();
        expect(confirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Replace the image with a generated one?',
            })
        );
        expect(generate).not.toHaveBeenCalled();

        confirm.mockResolvedValue(true);
        click(GENERATE);
        await flush();
        expect(generate).toHaveBeenCalledWith(
            'characters',
            'thomas',
            expect.objectContaining({ version: first.version })
        );
        await vi.waitFor(async () =>
            expect(
                (await api.getImage('characters', 'thomas')).version
            ).not.toBe(first.version)
        );
    });

    it('shows a spinner and disables upload while generating', async () => {
        await render('Thomas waving');
        let finish: () => void = () => {};
        const pending = new Promise<void>((resolve) => (finish = resolve));
        const generate = api.generateImage;
        vi.spyOn(api, 'generateImage').mockImplementation(async (...args) => {
            await pending;
            return generate(...args);
        });
        click(GENERATE);
        await flush();
        expect(generateButton().disabled).toBe(true);
        expect(
            generateButton().querySelector('[role=progressbar]')
        ).not.toBeNull();
        expect(
            get<HTMLButtonElement>('[data-action="upload-image"]').disabled
        ).toBe(true);
        expect(
            get<HTMLButtonElement>(
                '[data-action="upload-image"]'
            ).querySelector('[role=progressbar]')
        ).toBeNull();

        finish();
        await generated();
        expect(generateButton().disabled).toBe(false);
        expect(
            get<HTMLButtonElement>('[data-action="upload-image"]').disabled
        ).toBe(false);
    });

    it('shows a failed generation and keeps the credits', async () => {
        const { ai } = await render('Please fail');
        click(GENERATE);
        await vi.waitFor(() =>
            expect(errorText()).toContain('The image could not be generated')
        );
        expect(ai.credits).toBe(10);
        expect($('img')).toBeNull();
    });

    it('explains why nothing is generated and calls no API', async () => {
        const { ai, info } = await setup();
        await mountAsync(
            <Editable
                initial="@intro.png"
                onChange={vi.fn()}
                api={api}
                owner="passages"
                id="village-thomas-forest"
                linkFrom="data/chapters/village/thomas.passages/forest.ts"
                ai={ai}
                info={info}
                mentions={testMentions()}
            />
        );
        await flush();
        const generate = vi.spyOn(api, 'generateImage');
        click(GENERATE);
        await flush();
        const LINKED =
            'This passage shows a linked image. Replace the link with a description to generate one.';
        expect(errorText()).toContain(LINKED);
        expect(generate).not.toHaveBeenCalled();

        typeInto(description(), '');
        expect(errorText()).not.toContain(LINKED);
        click(GENERATE);
        await flush();
        expect(errorText()).toContain(
            'Write a description of the picture first.'
        );
        expect(generate).not.toHaveBeenCalled();
    });

    it('is shown only with image generation, the AI feature and edit access', async () => {
        await render('Thomas');
        expect($(GENERATE)).not.toBeNull();
        unmount();

        await render('Thomas', { info: { info: null } });
        expect($(GENERATE)).toBeNull();
        unmount();

        const { ai, info } = await setup({ aiImageGeneration: false });
        await mountAsync(
            <Editable
                initial="Thomas"
                onChange={vi.fn()}
                api={api}
                owner="characters"
                id="thomas"
                ai={ai}
                info={info}
                mentions={testMentions()}
            />
        );
        expect($(GENERATE)).toBeNull();
        unmount();

        const withAi = await setup();
        await mountAsync(
            <ImageEditor
                api={api}
                owner="characters"
                id="thomas"
                ariaLabel="Image"
                ai={withAi.ai}
                info={withAi.info}
            />
        );
        expect($(GENERATE)).toBeNull();
    });

    it('is disabled without credits', async () => {
        const { ai, info } = await setup({ aiCredits: 0 });
        await mountAsync(
            <Editable
                initial="Thomas"
                onChange={vi.fn()}
                api={api}
                owner="characters"
                id="thomas"
                ai={ai}
                info={info}
                mentions={testMentions()}
            />
        );
        await flush();
        expect(generateButton().disabled).toBe(true);
        expect(generateButton().getAttribute('aria-label')).toBe(
            'No AI credits left'
        );
    });
});
