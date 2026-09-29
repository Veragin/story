/**
 * The story this Visualizer edits (multiple stories, phase 7). The server holds several stories,
 * each under `/api/stories/<id>/…`; the landing page opens the client on one with `?story=<id>`.
 *
 * The id is read once, when the app loads: every api call, the event stream and the `ui-state`
 * keys use it, so switching stories is a new page load (the landing page's **Open**). Without it
 * `main.tsx` sends the browser back to the landing page (`goToLanding`). Mock mode needs no
 * server and so no story: it falls back to `example`.
 */

/** `?story=<id>` of `search` (default: this page's), or `null` when absent or empty. */
export const readStoryId = (search: string = typeof window === 'undefined' ? '' : window.location.search) =>
    new URLSearchParams(search).get('story') || null;

const useMock = import.meta.env.VITE_VISUALIZER_API === 'mock';

/** The edited story's id; `''` when the page has no `?story=` (the app then leaves, see above). */
export const STORY_ID: string = readStoryId() ?? (useMock ? 'example' : '');

/**
 * The landing page (the story list): `VITE_LANDING_URL`, else this host on port 8103, the
 * landing page's dev port (so `localhost`, `127.0.0.1` or a LAN address all work).
 */
export const landingUrl = (): string =>
    import.meta.env.VITE_LANDING_URL || `${window.location.protocol}//${window.location.hostname}:8103`;

/** Leave for the landing page: no story, "← Stories", or a cancelled password prompt. */
export const goToLanding = () => window.location.assign(landingUrl());
