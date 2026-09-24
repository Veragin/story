import { Body, Controller, Get, HttpException, HttpStatus, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { UpdateStructureDto } from '../common/dto';
import { EditorService } from '../editor/EditorService';
import { FileWatcherService } from '../events/FileWatcherService';
import { StoryIndexService } from '../story/StoryIndexService';
import { TsWriterService } from '../writer/TsWriterService';
import { FormatterService } from '../writer/FormatterService';
import { StructureService, type TStructureType } from './StructureService';
import { TypecheckService } from './TypecheckService';

/**
 * `GET|PUT /api/structure…` — the structure tab (VISUALIZER_PLAN §5.3, §7 Phase 10).
 *
 * The write path is deliberately three steps, in this order and no other:
 *
 *  1. **Render** the edited type into candidate text, without touching disk. A shape the reader
 *     does not fully understand is refused here, with `422` and the reason.
 *  2. **Format** it with the repo's Prettier, so the file is byte-identical to what
 *     `yarn pretty` would produce (§4.5 rule 1) — before the typecheck, so what is verified is
 *     what is kept.
 *  3. **Write, typecheck, roll back on failure.** The author cannot end up with a story that
 *     does not compile because of a form (§8 risk 6).
 *
 * A failed typecheck answers `422` with the compiler's own output. Not a `500`: nothing went
 * wrong with the server — the *edit* was invalid, and the message the author needs is `tsc`'s.
 */
@Controller('structure')
export class StructureController {
    constructor(
        private readonly structure: StructureService,
        private readonly typecheck: TypecheckService,
        private readonly formatter: FormatterService,
        private readonly writer: TsWriterService,
        private readonly index: StoryIndexService,
        private readonly watcher: FileWatcherService,
        private readonly editor: EditorService
    ) {}

    @Get()
    async list(): Promise<TStructureType[]> {
        return await this.structure.list();
    }

    @Get(':typeName')
    async one(@Param('typeName') typeName: string): Promise<TStructureType> {
        const type = await this.structure.get(typeName);
        if (!type) throw new NotFoundException(`No type alias named "${typeName}"`);
        return type;
    }

    @Put(':typeName')
    async update(@Param('typeName') typeName: string, @Body() body: UpdateStructureDto): Promise<TStructureType> {
        const before = await this.structure.get(typeName);
        if (!before) throw new NotFoundException(`No type alias named "${typeName}"`);

        // `If-Match` before anything else: a structural edit computed against a stale reading of
        // the type is the one most worth refusing.
        await this.writer.assertUnchanged(before.file, body.hash);

        const { file, text } = await this.structure.renderEdits(typeName, body.edits);
        const formatted = await this.formatter.format(text, file);

        this.watcher.suppressNext(file);
        const result = await this.typecheck.writeIfItCompiles(file, formatted);

        if (!result.ok) {
            throw new HttpException(
                {
                    success: false,
                    error: `That change does not compile, so it was not kept.\n\n${result.output}`,
                    file,
                },
                HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        this.index.invalidate();

        const after = await this.structure.get(typeName);
        if (!after) throw new NotFoundException(`"${typeName}" disappeared while being edited`);
        return after;
    }

    @Post(':typeName/open')
    async open(@Param('typeName') typeName: string): Promise<{ opened: boolean; file: string }> {
        const type = await this.structure.get(typeName);
        if (!type) throw new NotFoundException(`No type alias named "${typeName}"`);
        const opened = await this.editor.open(type.file, type.line);
        return { opened, file: type.file };
    }
}
