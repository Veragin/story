import { Body, Controller, Delete, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { SetTimeDto } from '../common/dto';
import { FileWatcherService } from '../events/FileWatcherService';
import { SourceFileService } from '../story/SourceFileService';
import { StoryIndexService } from '../story/StoryIndexService';
import { WriterRefusal } from '../writer/TsWriterService';
import { assertPassageType } from './PassageController';

/**
 * `PUT`, `POST …/setTime` and `DELETE` for passages (VISUALIZER_PLAN §5.3).
 *
 * ## This controller mostly refuses, and that is the design
 *
 * §4.5 rule 2 is explicit: *"if the export is not an object literal (a passage is a **function**),
 * the writer refuses with `422` and an explanatory message rather than guessing."* A passage file
 * exports `(s, e) => ({ … })` — the returned object is computed, its `body` can branch on world
 * state, and its links can be built from it. There is no "set the title property" that is
 * generally safe, because the property may not exist in the branch the author cares about.
 *
 * So:
 *
 *  - **`PUT` on an existing passage refuses (`422`)** with a message naming the file, so the
 *    author can open it. `POST …/open` exists for precisely this next step.
 *  - **`PUT` on a passage that does not exist yet creates one** — there is no author logic to
 *    lose in a file that is not there, and the creation forms the client already has are how a
 *    passage gets made. The generated file is a plain arrow function returning a literal: the
 *    shape the rest of the story uses, with nothing generated-looking about it (rule 3).
 *  - **`setTime` refuses**, always. A passage's cost is a `DeltaTime` inside a `links` array
 *    inside a `body` array, often behind a condition; there is no single property to set.
 *  - **`DELETE` removes the file.** Deleting is not editing: there is no author logic to
 *    preserve in a file that is going away.
 *
 * This is the plan working as intended rather than a gap. The map and the timeline are edited on
 * a canvas because their data *is* geometry; passages are edited in an editor because they are
 * code.
 */
@Controller('passage')
export class PassageWriteController {
    constructor(
        private readonly index: StoryIndexService,
        private readonly files: SourceFileService,
        private readonly watcher: FileWatcherService
    ) {}

    @Put(':type/:passageId')
    async update(
        @Param('type') type: string,
        @Param('passageId') passageId: string,
        @Body() body: unknown
    ): Promise<{ created: boolean; file: string }> {
        assertPassageType(type);

        const existing = await this.index.getPassage(passageId);
        if (existing) {
            throw new WriterRefusal(
                `Passage "${passageId}" is a function of (s, e), and the Visualizer will not rewrite one — ` +
                    `open ${existing.file} and edit it directly (POST /api/passage/${type}/${passageId}/open).`,
                existing.file
            );
        }

        return this.create(type, passageId, body);
    }

    @Post(':type/:passageId/setTime')
    setTime(@Param('type') type: string, @Param('passageId') passageId: string, @Body() body: SetTimeDto): never {
        assertPassageType(type);
        void body;
        throw new WriterRefusal(
            `A passage's time cost lives in a DeltaTime inside its links, often behind a condition — ` +
                `there is no single property for the Visualizer to set. Edit "${passageId}" directly.`,
            passageId
        );
    }

    @Delete(':type/:passageId')
    async remove(
        @Param('type') type: string,
        @Param('passageId') passageId: string
    ): Promise<{ deleted: string; file: string; referencedBy: string[] }> {
        assertPassageType(type);

        const passage = await this.index.getPassage(passageId);
        if (!passage) throw new NotFoundException(`No passage "${passageId}"`);

        /**
         * Passages that link *to* this one. Reported rather than refused: unlike a dangling
         * `TMapId`, a dangling passage link still typechecks (the id is a template-literal
         * type), so the author can legitimately delete a passage and fix its callers next. The
         * list is what turns that into a deliberate act rather than a surprise at play time.
         */
        const referencedBy = (await this.index.getPassages())
            .filter((other) => other.id !== passageId && other.linkedPassageIds.includes(passageId))
            .map((other) => other.id);

        // One passage per file is the story's convention, but not a guarantee. Deleting a file
        // that declares several would take the others with it.
        const siblings = (await this.index.getPassages()).filter(
            (other) => other.file === passage.file && other.id !== passageId
        );
        if (siblings.length > 0) {
            throw new WriterRefusal(
                `"${passage.file}" also declares ${siblings.map((other) => other.id).join(', ')} — ` +
                    `the Visualizer deletes whole files, so it will not delete this one.`,
                passage.file
            );
        }

        this.watcher.suppressNext(passage.file);
        await this.files.remove(passage.file);
        this.index.invalidate();

        return { deleted: passageId, file: passage.file, referencedBy };
    }

    /**
     * Writes a new passage file.
     *
     * The template is deliberately minimal and deliberately *not* marked as generated (§4.5
     * rule 3): the author is expected to open it and write the real thing, and a
     * `DO NOT EDIT` banner on a file whose entire purpose is to be edited would be a lie.
     */
    private async create(
        type: 'screen' | 'linear' | 'transition',
        passageId: string,
        body: unknown
    ): Promise<{ created: boolean; file: string }> {
        const parts = passageId.split('-');
        if (parts.length < 3) {
            throw new WriterRefusal(
                `"${passageId}" is not a <chapter>-<character>-<passage> id, so the Visualizer cannot tell where it belongs`,
                passageId
            );
        }

        const [chapterId, characterId, ...rest] = parts;
        const localId = rest.join('-');

        const chapter = await this.index.getChapter(chapterId);
        if (!chapter) throw new NotFoundException(`No chapter "${chapterId}" for passage "${passageId}"`);

        const title = titleFrom(body) ?? localId;
        const file = `data/chapters/${chapterId}/${characterId}.passages/${localId}.${type}.ts`;

        if (await this.files.exists(file)) {
            throw new WriterRefusal(`"${file}" already exists`, file);
        }

        this.watcher.suppressNext(file);
        await this.files.write(file, passageTemplate({ chapterId, characterId, localId, type, title }));
        this.index.invalidate();

        return { created: true, file };
    }
}

const titleFrom = (body: unknown): string | null => {
    if (!body || typeof body !== 'object') return null;
    const title = (body as { title?: unknown }).title;
    return typeof title === 'string' && title.trim() ? title.trim() : null;
};

/**
 * A new passage, in the shape the story already uses.
 *
 * Not built with ts-morph: there is no existing file to preserve, and a template string is both
 * readable here and exactly what an author would have typed. It is run through Prettier by the
 * caller either way.
 */
const passageTemplate = (passage: {
    chapterId: string;
    characterId: string;
    localId: string;
    type: 'screen' | 'linear' | 'transition';
    title: string;
}): string => {
    const symbol = `${passage.localId.replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : ''))}Passage`;
    const typeName =
        passage.type === 'screen'
            ? 'TPassageScreen'
            : passage.type === 'linear'
              ? 'TPassageLinear'
              : 'TPassageTransition';

    const bodyByType: Record<string, string> = {
        screen: `    body: [
        {
            condition: true,
            text: '',
            links: [],
        },
    ],`,
        linear: `    text: '',
    nextPassageId: '',`,
        transition: `    redirect: '',`,
    };

    return `import { ${typeName} } from '@story/types';

export const ${symbol}: ${typeName}<'${passage.chapterId}', '${passage.characterId}', string> = {
    chapterId: '${passage.chapterId}',
    characterId: '${passage.characterId}',
    id: '${passage.localId}',
    type: '${passage.type}',
    title: '${passage.title.replace(/'/g, "\\'")}',
${bodyByType[passage.type]}
};
`;
};
