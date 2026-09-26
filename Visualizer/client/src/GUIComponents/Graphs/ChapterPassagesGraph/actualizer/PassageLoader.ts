import { mockApi, displayText } from '../../../../api';
import type { TGraphPassage, TGraphPassages } from './graphPassage';

/**
 * Loads a chapter's passages for the graph. It used to import `register.passages` from
 * `@story/data` and *run* every passage function; it now reads the api's statically extracted
 * passages and edges — from `mockApi` until WP6 moves the chapter view to the real server
 * (plan WP1, §3 "Live refresh" point 1).
 */
export class PassageLoader {
    async loadPassages(chapterId: string): Promise<TGraphPassages | null> {
        try {
            const [{ passages, edges }, project] = await Promise.all([
                mockApi.listChapterPassages(chapterId),
                mockApi.getProject(),
            ]);
            const chapterName = new Map(project.chapters.map((c) => [c.id, c.name]));
            const result: TGraphPassages = {};

            for (const p of passages) {
                const own = edges.filter((e) => e.from === p.passageId);
                const next = own.find((e) => e.kind === 'next');
                const passage: TGraphPassage = {
                    passageId: p.passageId,
                    localId: p.localId,
                    characterId: p.characterId,
                    type: p.type,
                    title: p.type === 'screen' ? displayText(p.title, p.passageId) : p.passageId,
                    links: own.filter((e) => e.kind === 'link').map((e) => e.to),
                    redirects: own.filter((e) => e.kind === 'redirect').map((e) => e.to),
                    next: next?.to,
                    nextResolved: next?.resolved ?? false,
                };
                if (p.type === 'transition') {
                    passage.title = next?.resolved ? await this.transitionTitle(next.to, chapterName) : '';
                }
                result[p.passageId] = passage;
            }
            return result;
        } catch (error) {
            console.error(`Error loading passages for chapter ${chapterId}:`, error);
            return null;
        }
    }

    /** `Kingdom Chapter - Intro` for a transition to `kingdom-annie-intro`. */
    private async transitionTitle(target: string, chapterName: Map<string, string>): Promise<string> {
        const [chapterId] = target.split('-');
        const passage = await mockApi.getPassage(target);
        const title = passage.type === 'screen' ? displayText(passage.title, target) : target;
        return `${chapterName.get(chapterId) ?? chapterId} - ${title}`;
    }
}
