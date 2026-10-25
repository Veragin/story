import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorldState } from '@story/core';
import { PLAY_MANIFEST_FILE, type TPlayManifestDto } from '@story/protocol';
import { exampleStoryTexts } from '../../shared/storyLoader/__tests__/support/memorySource';
import { loadStory } from '../src/worldState';
import { StaticStorySource } from '../src/source/StaticStorySource';

const EXPORT_DIR = 'https://games.example.org/my-story/';

const exportedSite = () => {
    const texts = exampleStoryTexts();
    const manifest: TPlayManifestDto = {
        id: 'example',
        name: 'Example',
        author: 'Author',
        description: '',
        version: '1',
        hasLandingImage: false,
        files: Object.keys(texts).sort(),
    };
    const site = new Map(Object.entries(texts).map(([file, text]) => [EXPORT_DIR + file, text]));
    site.set(EXPORT_DIR + PLAY_MANIFEST_FILE, JSON.stringify(manifest));
    return { site, manifest };
};

const serve = (site: ReadonlyMap<string, string>) => {
    const fetched: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
        fetched.push(url);
        const text = site.get(url);
        return Promise.resolve(
            text === undefined ? new Response('not found', { status: 404 }) : new Response(text, { status: 200 })
        );
    });
    return fetched;
};

const setBase = (href: string) => {
    const base = document.createElement('base');
    base.href = href;
    document.head.appendChild(base);
};

describe('StaticStorySource', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.head.querySelectorAll('base').forEach((b) => b.remove());
    });

    it('reads play.json and the story files next to index.html', async () => {
        setBase(`${EXPORT_DIR}index.html`);
        const { site, manifest } = exportedSite();
        const fetched = serve(site);
        const source = new StaticStorySource();

        const loaded = await source.loadManifest();
        expect(loaded).toEqual(manifest);

        const story = await loadStory(source, loaded.files);
        const { e } = createWorldState(story, loaded.id);
        await e.startAs('thomas');

        await vi.waitFor(() => expect(e.store.passage?.id).toBe('intro'));
        expect(fetched.length).toBeGreaterThan(1);
        expect(fetched.every((url) => url.startsWith(EXPORT_DIR))).toBe(true);
    });

    it('resolves file URLs against the page`s folder', () => {
        setBase(`${EXPORT_DIR}index.html?x=1`);
        const source = new StaticStorySource();
        expect(source.fileUrl('data/assets/landing.png')).toBe(`${EXPORT_DIR}data/assets/landing.png`);
    });

    it('fails when there is no play.json', async () => {
        serve(new Map());
        await expect(new StaticStorySource(EXPORT_DIR).loadManifest()).rejects.toThrow(/404/);
    });
});
