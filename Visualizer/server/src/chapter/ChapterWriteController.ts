import { Body, Controller, Delete, Headers, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { SetTimeDto, UpdateChapterDto, UpdateLayoutDto } from '../common/dto';
import { FileWatcherService } from '../events/FileWatcherService';
import { SourceFileService } from '../story/SourceFileService';
import { StoryIndexService } from '../story/StoryIndexService';
import type { TChapterSummary } from '../story/types';
import { RegisterWriterService } from '../writer/RegisterWriterService';
import { TsWriterService, WriterRefusal, literal, raw } from '../writer/TsWriterService';

/**
 * `PUT`, `DELETE`, `setTime` and `layout` for chapters (VISUALIZER_PLAN §5.3).
 *
 * ## `Time` has to be written as a call, not as a number
 *
 * `timeRange` is `{ start: Time, end: Time }`, and the author's files build those with
 * `Time.fromString('2.1. 8:00')`. Writing `start: 115200` would typecheck as neither and would
 * lose the readable form the author wrote. So the writer emits `Time.fromS(n)` as *raw
 * source text* — that is what `raw()` exists for — and checks that the file already imports
 * `Time` before doing so, refusing rather than producing a file that does not compile.
 *
 * ## The layout route
 *
 * `PUT /api/chapter/:id/layout` is §4.4: passage positions, in the chapter file they belong to,
 * replacing the `localStorage` the graph used to use. Keys that name no registered passage are
 * **pruned on write** rather than rejected — a renamed passage leaves a dangling key, and the
 * plan's answer is that the client drops it and the next save prunes it, not that the save fails.
 */
@Controller('chapter')
export class ChapterWriteController {
    constructor(
        private readonly index: StoryIndexService,
        private readonly writer: TsWriterService,
        private readonly registers: RegisterWriterService,
        private readonly files: SourceFileService,
        private readonly watcher: FileWatcherService
    ) {}

    @Put(':chapterId')
    async update(
        @Param('chapterId') chapterId: string,
        @Body() body: UpdateChapterDto,
        @Headers('if-match') ifMatch?: string
    ): Promise<TChapterSummary> {
        const chapter = await this.requireChapter(chapterId);

        const edits = [];
        if (body.title !== undefined) edits.push({ name: 'title', initializer: literal(body.title) });
        if (body.description !== undefined) {
            edits.push({ name: 'description', initializer: literal(body.description) });
        }
        if (body.location !== undefined) {
            const known = await this.index.getLocation(body.location);
            if (!known) {
                throw new WriterRefusal(
                    `Chapter "${chapterId}" cannot be set to unknown location "${body.location}"`,
                    chapter.file
                );
            }
            edits.push({ name: 'location', initializer: literal(body.location) });
        }

        return this.applyAndReread(chapterId, chapter.file, edits, ifMatch ?? body.hash);
    }

    @Post(':chapterId/setTime')
    async setTime(
        @Param('chapterId') chapterId: string,
        @Body() body: SetTimeDto,
        @Headers('if-match') ifMatch?: string
    ): Promise<TChapterSummary> {
        const chapter = await this.requireChapter(chapterId);

        if (body.end <= body.start) {
            throw new WriterRefusal(
                `Chapter "${chapterId}" would end at or before it starts (${body.start} → ${body.end})`,
                chapter.file
            );
        }

        await this.assertImportsTime(chapter.file);

        return this.applyAndReread(
            chapterId,
            chapter.file,
            [
                {
                    name: 'timeRange',
                    initializer: literal({
                        start: raw(`Time.fromS(${body.start})`),
                        end: raw(`Time.fromS(${body.end})`),
                    }),
                },
            ],
            ifMatch ?? body.hash
        );
    }

    @Put(':chapterId/layout')
    async setLayout(
        @Param('chapterId') chapterId: string,
        @Body() body: UpdateLayoutDto,
        @Headers('if-match') ifMatch?: string
    ): Promise<TChapterSummary> {
        const chapter = await this.requireChapter(chapterId);

        const known = new Set(
            (await this.index.getPassages())
                .filter((passage) => passage.chapterId === chapterId)
                .map((passage) => passage.id)
        );

        const entries = Object.entries(body.layout ?? {});
        const pruned: Record<string, { x: number; y: number }> = {};

        for (const [passageId, point] of entries) {
            // Dangling keys are dropped, not rejected (§4.4).
            if (!known.has(passageId)) continue;
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
            // Rounded: a canvas position is a pixel, and sub-pixel precision in `data/` is
            // fifteen characters of diff per passage per drag for no visible difference.
            pruned[passageId] = { x: Math.round(point.x), y: Math.round(point.y) };
        }

        return this.applyAndReread(
            chapterId,
            chapter.file,
            [
                {
                    name: 'layout',
                    // An empty layout removes the property rather than writing `layout: {}` —
                    // the field is optional, and an empty object is noise in the author's file.
                    initializer: Object.keys(pruned).length === 0 ? undefined : literal(pruned),
                },
            ],
            ifMatch ?? body.hash
        );
    }

    @Delete(':chapterId')
    async remove(@Param('chapterId') chapterId: string): Promise<{ deleted: string; file: string }> {
        const chapter = await this.requireChapter(chapterId);

        /**
         * A chapter referenced as another chapter's child would be left dangling. Refusing is
         * the honest answer for the same reason as the map case: the alternative is editing
         * files the author did not ask about.
         */
        const referencedBy = (await this.index.getChapters()).filter(
            (other) => other.id !== chapterId && other.childChapterIds.includes(chapterId)
        );
        if (referencedBy.length > 0) {
            throw new WriterRefusal(
                `Chapter "${chapterId}" is still a child of ${referencedBy.map((other) => other.id).join(', ')}`,
                chapter.file
            );
        }

        // Both register slices: a chapter has an entry *and* a lazy passage-module loader.
        await this.registers.removeEntry('chapters', chapterId);
        await this.registers.removeEntry('passages', chapterId);

        if (chapter.file) {
            this.watcher.suppressNext(chapter.file);
            await this.files.remove(chapter.file);
        }

        this.index.invalidate();
        return { deleted: chapterId, file: chapter.file };
    }

    /* ----------------------------------------------------------------- helpers */

    private async requireChapter(chapterId: string): Promise<TChapterSummary> {
        const chapter = await this.index.getChapter(chapterId);
        if (!chapter) throw new NotFoundException(`No chapter "${chapterId}"`);
        if (!chapter.file) throw new WriterRefusal(`No file for chapter "${chapterId}"`, chapterId);
        return chapter;
    }

    /**
     * Refuses to write a `Time.fromS(…)` call into a file that does not import `Time`.
     *
     * Adding the import automatically would be the obvious alternative and is the wrong one: the
     * only files with a `timeRange` already import `Time`, so a file without it is not the shape
     * this writer thinks it is, and writing to it would be guessing (§4.5 rule 2).
     */
    private async assertImportsTime(file: string): Promise<void> {
        const source = await this.files.read(file);
        if (!/\bimport\b[^;]*\bTime\b[^;]*from\s+'@story\/shared'/.test(source)) {
            throw new WriterRefusal(
                `"${file}" does not import Time from '@story/shared', so the Visualizer will not write a time range into it`,
                file
            );
        }
    }

    private async applyAndReread(
        chapterId: string,
        file: string,
        edits: { name: string; initializer: string | undefined }[],
        expectedHash: string | undefined
    ): Promise<TChapterSummary> {
        this.watcher.suppressNext(file);
        await this.writer.setProperties(file, exportNameForChapter(chapterId), edits, expectedHash);

        this.index.invalidate();
        const refreshed = await this.index.getChapter(chapterId);
        if (!refreshed) throw new NotFoundException(`No chapter "${chapterId}"`);
        return { ...refreshed, hash: await this.files.hashOf(file) };
    }
}

/** `village` → `villageChapter`, matching `data/chapters/village/village.chapter.ts`. */
export const exportNameForChapter = (chapterId: string): string => `${chapterId}Chapter`;
