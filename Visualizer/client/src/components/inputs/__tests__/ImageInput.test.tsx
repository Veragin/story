import '@story/shared'; // installs the global `_`
import { $, click, get, mountAsync, typeInto, unmount } from './dom';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TImageDto, TMaybeCode } from '@story/visualizer-protocol';
import type { TVisualizerApi } from '../../../api';
import { ImageInput } from '../ImageInput';

const image = (url: string | null): TImageDto => ({
    owner: 'characters',
    id: 'annie',
    file: 'data/characters/annie.png',
    version: url ? 'v1' : '',
    url,
});

const fakeApi = (dto: TImageDto) =>
    ({
        getImage: vi.fn(() => Promise.resolve(dto)),
        uploadImage: vi.fn(),
    }) as unknown as TVisualizerApi;

describe('ImageInput', () => {
    afterEach(unmount);

    const render = async (
        dto: TImageDto,
        description: TMaybeCode<string> | undefined,
        onDescriptionChange = vi.fn()
    ) => {
        await mountAsync(
            <ImageInput
                api={fakeApi(dto)}
                owner="characters"
                id="annie"
                description={description}
                onDescriptionChange={onDescriptionChange}
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
        expect(toggle.getAttribute('aria-label')).toBe('Show image');

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
            code: "_('Annie at the well')",
        });
        expect(textarea()).toBeNull();
        expect(document.body.textContent).toContain("_('Annie at the well')");
        click('[data-action="convert-to-value"]');
        expect(onChange).toHaveBeenCalledWith('Annie at the well');
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
