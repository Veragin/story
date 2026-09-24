import { Body, Controller, Delete, Get, Headers, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { UpdateEntityDto } from '../common/dto';
import { EditorService } from '../editor/EditorService';
import { FileWatcherService } from '../events/FileWatcherService';
import { StoryIndexService } from '../story/StoryIndexService';
import { RegisterWriterService, type TRegisterSlice } from '../writer/RegisterWriterService';
import { TsWriterService, WriterRefusal, literal } from '../writer/TsWriterService';
import { EntityService, type TEntityDetail, type TEntityKind } from './EntityService';

/**
 * `GET|PUT|DELETE /api/entity…` — the entities tab (VISUALIZER_PLAN §5.3, §7 Phase 9).
 *
 * One generic editor over every kind of thing in the story, rather than a bespoke form per kind.
 * What makes that safe is that `EntityService` declares, per kind, exactly which fields may be
 * written — so "generic" describes the *UI*, not the write surface. A `PUT` naming any other
 * field is a `422` with the reason, not a silent no-op.
 */
@Controller('entity')
export class EntityController {
    constructor(
        private readonly entities: EntityService,
        private readonly writer: TsWriterService,
        private readonly registers: RegisterWriterService,
        private readonly index: StoryIndexService,
        private readonly watcher: FileWatcherService,
        private readonly editor: EditorService
    ) {}

    @Get()
    async list(): Promise<TEntityKind[]> {
        return await this.entities.list();
    }

    @Get(':kind/:id')
    async one(@Param('kind') kind: string, @Param('id') id: string): Promise<TEntityDetail> {
        return await this.entities.get(kind, id);
    }

    @Put(':kind/:id')
    async update(
        @Param('kind') kind: string,
        @Param('id') id: string,
        @Body() body: UpdateEntityDto,
        @Headers('if-match') ifMatch?: string
    ): Promise<TEntityDetail> {
        if (!this.entities.has(kind, id)) throw new NotFoundException(`No ${kind} "${id}"`);

        const file = this.entities.fileOf(kind, id);
        if (!file) {
            throw new WriterRefusal(
                `"${kind}" entities are not stored one per file, so the Visualizer cannot edit one in isolation`,
                `${kind}/${id}`
            );
        }

        const allowed = await this.entities.editableFields(kind);
        const edits = [];

        for (const [name, value] of Object.entries(body.fields ?? {})) {
            if (!allowed.includes(name)) {
                throw new WriterRefusal(
                    `"${name}" is not an editable field of a ${kind}. Editable: ${allowed.join(', ') || 'none'}.`,
                    file
                );
            }
            edits.push({ name, initializer: literal(value) });
        }

        if (edits.length > 0) {
            this.watcher.suppressNext(file);
            await this.writer.setProperties(file, this.entities.exportOf(kind, id), edits, ifMatch ?? body.hash);
            this.index.invalidate();
        }

        // Patched with what was just written: the read model reads chapters, locations and maps
        // from the *imported* register, and an ESM module record cannot be re-evaluated in a
        // running process — so a plain re-read would answer with the pre-write values until the
        // dev server restarts. The hash comes from disk and is always current.
        const detail = await this.entities.get(kind, id);
        return {
            ...detail,
            fields: detail.fields.map((field) =>
                field.name in (body.fields ?? {})
                    ? { ...field, value: body.fields![field.name] as typeof field.value }
                    : field
            ),
        };
    }

    @Delete(':kind/:id')
    async remove(@Param('kind') kind: string, @Param('id') id: string): Promise<{ deleted: string }> {
        if (!this.entities.has(kind, id)) throw new NotFoundException(`No ${kind} "${id}"`);

        const slice = REGISTER_SLICES[kind];
        if (!slice) {
            throw new WriterRefusal(
                `"${kind}" entities are not registered individually and cannot be deleted here`,
                id
            );
        }

        await this.registers.removeEntry(slice, id);
        this.index.invalidate();
        return { deleted: id };
    }

    @Post(':kind/:id/open')
    async open(@Param('kind') kind: string, @Param('id') id: string): Promise<{ opened: boolean; file: string }> {
        const file = this.entities.fileOf(kind, id);
        if (!file) throw new NotFoundException(`No file for ${kind} "${id}"`);
        const opened = await this.editor.open(file, this.index.lineOfExport(file, this.entities.exportOf(kind, id)));
        return { opened, file };
    }
}

/** Which register slice each kind lives in. Items are absent: they are not in the register. */
const REGISTER_SLICES: Record<string, TRegisterSlice | undefined> = {
    character: 'characters',
    sideCharacter: 'sideCharacters',
    chapter: 'chapters',
    location: 'locations',
    map: 'maps',
};
