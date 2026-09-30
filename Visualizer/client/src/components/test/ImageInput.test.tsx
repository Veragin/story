import '@story/shared'; // installs the global `_`
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TImageDto, TMaybeCode } from '@story/visualizer-protocol';
import type { TVisualizerApi } from '../../api';
import { ImageInput } from '../ImageInput';

(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const image = (url: string | null): TImageDto => ({
    owner: 'characters',
    id: 'annie',
    file: 'data/characters/annie.png',
    version: url ? 'v1' : '',
    url,
});

/** Only the two image calls; the rest of the api is never reached. */
const fakeApi = (dto: TImageDto) =>
    ({
        getImage: vi.fn(() => Promise.resolve(dto)),
        uploadImage: vi.fn(),
    }) as unknown as TVisualizerApi;

describe('ImageInput', () => {
    let root: Root | null = null;

    afterEach(() => {
        act(() => root?.unmount());
        root = null;
        document.body.innerHTML = '';
    });

    const render = async (
        dto: TImageDto,
        description: TMaybeCode<string> | undefined,
        onDescriptionChange = vi.fn()
    ) => {
        const container = document.body.appendChild(
            document.createElement('div')
        );
        root = createRoot(container);
        // async act: flushes the `getImage` promise and the render after it
        await act(() =>
            Promise.resolve(
                root!.render(
                    <ImageInput
                        api={fakeApi(dto)}
                        owner="characters"
                        id="annie"
                        description={description}
                        onDescriptionChange={onDescriptionChange}
                    />
                )
            )
        );
        return onDescriptionChange;
    };

    const $ = <T extends Element = HTMLElement>(selector: string) =>
        document.querySelector<T & HTMLElement>(selector);
    const textarea = () =>
        $<HTMLTextAreaElement>('[data-field="image-description"]');

    /** Type into a React-controlled textarea: set the value natively, then fire `input`. */
    const type = (el: HTMLTextAreaElement, value: string) => {
        const setter = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(el),
            'value'
        )!.set!;
        act(() => {
            setter.call(el, value);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });
    };

    it('shows only the image when there is one, with the overlay buttons', async () => {
        await render(image('data:image/png;base64,AAAA'), 'Annie at the well');
        const img = $<HTMLImageElement>('img')!;
        expect(img.getAttribute('src')).toBe('data:image/png;base64,AAAA');
        expect(img.getAttribute('alt')).toBe('Annie at the well');
        expect(textarea()).toBeNull();
        expect($('[data-action="replace-image"]')).not.toBeNull();
        expect($('[data-action="toggle-description"]')).not.toBeNull();
        expect($('[data-action="upload-image"]')).toBeNull();
    });

    it('toggles the frame between the image and the description', async () => {
        await render(image('data:image/png;base64,AAAA'), 'Annie at the well');
        const toggle = $('[data-action="toggle-description"]')!;
        expect(toggle.getAttribute('aria-label')).toBe('Show description');

        act(() => toggle.click());
        expect($('img')).toBeNull();
        expect(textarea()!.value).toBe('Annie at the well');
        expect(toggle.getAttribute('aria-label')).toBe('Show image');

        act(() => toggle.click());
        expect($('img')).not.toBeNull();
        expect(textarea()).toBeNull();
    });

    it('shows the description and an upload button without an image', async () => {
        await render(image(null), undefined);
        expect($('img')).toBeNull();
        expect(textarea()!.value).toBe('');
        expect(textarea()!.getAttribute('placeholder')).toBe(
            'What the picture shows'
        );
        const upload = $<HTMLButtonElement>('[data-action="upload-image"]')!;
        expect(upload.disabled).toBe(false);
        expect($('[data-action="toggle-description"]')).toBeNull();
    });

    it('reports a description change', async () => {
        const onChange = await render(image(null), 'old');
        type(textarea()!, 'A portrait of Annie');
        expect(onChange).toHaveBeenCalledWith('A portrait of Annie');
    });

    it('shows a code description read-only, with convert to text', async () => {
        const onChange = await render(image(null), {
            code: "_('Annie at the well')",
        });
        expect(textarea()).toBeNull();
        expect(document.body.textContent).toContain("_('Annie at the well')");
        const convert = $<HTMLButtonElement>(
            '[data-action="convert-to-text"]'
        )!;
        act(() => convert.click());
        expect(onChange).toHaveBeenCalledWith('Annie at the well');
    });

    it('converts code that is not a plain string to its source text', async () => {
        const onChange = await render(image('data:image/png;base64,AAAA'), {
            code: 's.name + "!"',
        });
        act(() => $('[data-action="toggle-description"]')!.click());
        act(() => $('[data-action="convert-to-text"]')!.click());
        expect(onChange).toHaveBeenCalledWith('s.name + "!"');
    });
});
