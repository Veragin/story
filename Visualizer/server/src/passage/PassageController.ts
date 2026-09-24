import { BadRequestException, Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { StoryIndexService } from '../story/StoryIndexService';
import type { TPassageSummary } from '../story/types';

/** The three passage shapes the routes are keyed by (VISUALIZER_PLAN §5.3). */
const PASSAGE_TYPES = ['screen', 'linear', 'transition'] as const;
type TPassageType = (typeof PASSAGE_TYPES)[number];

/**
 * `GET /api/passage/:type/:passageId` (VISUALIZER_PLAN §5.3).
 *
 * The type is in the path rather than inferred from the id, and that is the client's existing
 * shape winning over the README's older list (§5.3: "the client's existing route set wins").
 * It is also load-bearing for the writes in Phase 5: a passage file's *shape* differs by type,
 * so the writer has to know which one it is being asked to edit before it opens the file,
 * rather than discovering a mismatch half-way through.
 *
 * A read whose declared type disagrees with what is actually in the source is a `404`, not a
 * silent success: the client asked for something that does not exist.
 */
@Controller('passage')
export class PassageController {
    constructor(private readonly index: StoryIndexService) {}

    @Get(':type/:passageId')
    async one(@Param('type') type: string, @Param('passageId') passageId: string): Promise<TPassageSummary> {
        assertPassageType(type);

        const passage = await this.index.getPassage(passageId);
        if (!passage) throw new NotFoundException(`No passage "${passageId}"`);

        // `unknown` means the indexer could not read a literal `type` — a computed one. Let it
        // through rather than 404ing on a passage that plainly exists.
        if (passage.type !== 'unknown' && passage.type !== type) {
            throw new NotFoundException(`Passage "${passageId}" is a ${passage.type}, not a ${type}`);
        }

        return passage;
    }
}

export function assertPassageType(type: string): asserts type is TPassageType {
    if (!(PASSAGE_TYPES as readonly string[]).includes(type)) {
        throw new BadRequestException(`Unknown passage type "${type}" — expected ${PASSAGE_TYPES.join(', ')}`);
    }
}
