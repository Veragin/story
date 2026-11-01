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
import { act, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TImageDto, TMaybeCode } from '@story/protocol';
import type { TStoryImageFile, TVisualizerApi } from '../../../api';
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
            />
        );
        return onDescriptionChange;
    };

    const TEXTAREA = '[data-field="image-description"]';
    const textarea = () => $<HTMLTextAreaElement>(TEXTAREA);

    it('shows only the image when there is one, with the overlay buttons', async () => {
        await render(image('data:image/png;base64,AAAA'), 'Annie at the well');
        const img = get<HTMLImageElement>('img');
        expect(img.getAttribute('src')).toBe('data:image/png;base64,AAAA');
        expect(img.getAttribute('alt')).toBe('Annie at the well');
        expect(textarea()).toBeNull();
        expect($('[data-action="replace-image"]')).not.toBeNull();
        expect($('[data-action="toggle-description"]')).not.toBeNull();
        expect($('[data-action="upload-image"]')).toBeNull();
    });

    it('toggles the frame between the image and the description', async () => {
        await render(image('data:image/png;base64,AAAA'), 'Annie at the well');
        const toggle = get('[data-action="toggle-description"]');
        expect(toggle.getAttribute('aria-label')).toBe('Show description');

        act(() => toggle.click());
        expect($('img')).toBeNull();
        expect(get<HTMLTextAreaElement>(TEXTAREA).value).toBe(
            'Annie at the well'
        );
        expect(toggle.getAttribute('aria-label')).toBe('Hide description');

        act(() => toggle.click());
        expect($('img')).not.toBeNull();
        expect(textarea()).toBeNull();
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
        expect($('[data-action="toggle-description"]')).toBeNull();
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
        expect($('[data-action="toggle-description"]')).toBeNull();
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
        click('[data-action="toggle-description"]');
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

    const Editable = ({
        initial,
        onChange,
    }: {
        initial: string;
        onChange: (value: string) => void;
    }) => {
        const [value, setValue] = useState(initial);
        const [api] = useState(() => fakeApi(passageImage, FILES));
        return (
            <ImageEditor
                api={api}
                owner="passages"
                id="village-thomas-forest"
                linkFrom={PASSAGE_FILE}
                value={value}
                onChange={(next) => {
                    setValue(next);
                    onChange(next);
                }}
                ariaLabel="Image"
            />
        );
    };

    const render = async (initial: string, onChange = vi.fn()) => {
        await mountAsync(<Editable initial={initial} onChange={onChange} />);
        await flush();
        return onChange;
    };

    const description = () =>
        get<HTMLTextAreaElement>('[data-field="image-description"]');
    const options = () =>
        $$('[data-option]').map((li) => li.getAttribute('data-option'));

    it('shows the linked image instead of the upload', async () => {
        await render('@intro.png');
        const img = get<HTMLImageElement>(`[data-linked-image="${INTRO}"]`);
        expect(img.getAttribute('src')).toBe('intro-url');
        expect($('[data-action="upload-image"]')).toBeNull();
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
        expect($('[data-action="upload-image"]')).toBeNull();
    });

    it('hints image paths relative to the passage only after @', async () => {
        await render('');
        typeInto(description(), 'A misty forest');
        expect(options()).toEqual([]);

        typeInto(description(), '@');
        expect(document.activeElement).toBe(description());
        expect(options()).toEqual([
            '@intro.png',
            '@../../kingdom/annie.passages/palace.png',
        ]);

        typeInto(description(), '@pal');
        expect(options()).toEqual(['@../../kingdom/annie.passages/palace.png']);
    });

    it('asks for a path while the link is only @', async () => {
        await render('@');
        expect($('[data-linked-image]')).toBeNull();
        expect(document.body.textContent).toContain(
            'Type the path of the image to link'
        );
    });

    it('picks the highlighted hint with the keyboard', async () => {
        const onChange = await render('');
        typeInto(description(), '@');
        const key = (k: string) =>
            act(() => {
                description().dispatchEvent(
                    new KeyboardEvent('keydown', { key: k, bubbles: true })
                );
            });
        key('ArrowDown');
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
