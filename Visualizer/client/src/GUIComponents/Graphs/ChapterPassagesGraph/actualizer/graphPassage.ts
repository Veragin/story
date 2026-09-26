import type { TPassageType } from '@story/visualizer-protocol';

/**
 * What the passage graph needs of a passage: its box (type, title, character) and its outgoing
 * edges, already statically extracted (`TChapterPassagesDto.edges`). Built by `PassageLoader`
 * from the api's DTOs, so nothing here ever evaluates story code.
 */
export type TGraphPassage = {
    passageId: string;
    localId: string;
    characterId: string;
    type: TPassageType;
    /** Display title; for a transition, where it leads (`Kingdom Chapter - Intro`). */
    title: string;
    /** Targets of `links[].passageId`. */
    links: string[];
    /** Targets of `body[].redirect`. */
    redirects: string[];
    /** `nextPassageId` of a linear / transition passage. */
    next?: string;
    /** For a transition: whether `next` points at an existing passage. */
    nextResolved: boolean;
};

export type TGraphPassages = Record<string, TGraphPassage>;
