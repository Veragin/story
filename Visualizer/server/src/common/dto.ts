import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';

/**
 * Request bodies (VISUALIZER_PLAN §5.3).
 *
 * These are validated by the global `ValidationPipe`, which is configured `whitelist` +
 * `forbidNonWhitelisted` — an unexpected property is a `400`, not silently dropped. That
 * matters more here than in a typical API: a write body becomes **text in the author's source
 * file**, so a property nobody declared is a property nobody thought about writing.
 *
 * The bounds are not decoration either. `points` and `strokes` come from a canvas that can
 * generate thousands of samples a second; a number that arrives as `Infinity` or `1e308` would
 * be written into `data/` verbatim and make the file unloadable.
 */

/** A world-space point. Bounded so a NaN or an absurd coordinate cannot reach a file. */
export class PointDto {
    @IsNumber({ allowInfinity: false, allowNaN: false })
    @Min(-1_000_000)
    @Max(1_000_000)
    x!: number;

    @IsNumber({ allowInfinity: false, allowNaN: false })
    @Min(-1_000_000)
    @Max(1_000_000)
    y!: number;
}

export class SizeDto {
    @IsNumber({ allowInfinity: false, allowNaN: false })
    @Min(0)
    @Max(1_000_000)
    width!: number;

    @IsNumber({ allowInfinity: false, allowNaN: false })
    @Min(0)
    @Max(1_000_000)
    height!: number;
}

/* ------------------------------------------------------------------ location */

export class LocationShapeDto {
    @IsString()
    @MaxLength(120)
    mapId!: string;

    /**
     * At least three points: below that there is no polygon, and `PolygonObject` refuses to go
     * there too — the rule is enforced on both sides so a hand-written request cannot store a
     * shape the editor could not have produced.
     */
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PointDto)
    points!: PointDto[];

    @IsString()
    @MaxLength(32)
    color!: string;

    @IsOptional()
    @IsInt()
    @Min(-1000)
    @Max(1000)
    z?: number;
}

export class UpdateLocationDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20_000)
    description?: string;

    /**
     * Optional and nullable, and the two mean different things: absent leaves the shape alone,
     * `null` removes it from the map. A client that only edits the name must not erase the
     * polygon by omission.
     */
    @IsOptional()
    @ValidateNested()
    @Type(() => LocationShapeDto)
    shape?: LocationShapeDto | null;

    /** `If-Match` may also be sent in the body, for clients that cannot set headers. */
    @IsOptional()
    @IsString()
    hash?: string;
}

/* ----------------------------------------------------------------------- map */

export class MapNoteDto {
    @IsString()
    @MaxLength(120)
    id!: string;

    @IsString()
    @MaxLength(2000)
    text!: string;

    @ValidateNested()
    @Type(() => PointDto)
    position!: PointDto;

    @IsOptional()
    @IsNumber({ allowInfinity: false, allowNaN: false })
    @Min(-360)
    @Max(360)
    rotation?: number;

    @IsOptional()
    @IsString()
    @MaxLength(32)
    color?: string;
}

export class MapStrokeDto {
    @IsString()
    @MaxLength(120)
    id!: string;

    @IsString()
    @MaxLength(32)
    color!: string;

    @IsNumber({ allowInfinity: false, allowNaN: false })
    @Min(0)
    @Max(10_000)
    width!: number;

    /**
     * Flat `[x, y, …]` (§4.3). Integers, because the client rounds before sending — a
     * fractional coordinate here means something skipped `BrushStroke.finish`, which is also
     * what would have simplified the stroke.
     */
    @IsArray()
    @IsInt({ each: true })
    points!: number[];
}

export class MapBackgroundDto {
    @IsString()
    @MaxLength(200)
    asset!: string;

    @ValidateNested()
    @Type(() => PointDto)
    position!: PointDto;

    @ValidateNested()
    @Type(() => SizeDto)
    size!: SizeDto;
}

export class UpdateMapDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    title?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => SizeDto)
    size?: SizeDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => MapBackgroundDto)
    background?: MapBackgroundDto | null;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MapNoteDto)
    notes?: MapNoteDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MapStrokeDto)
    strokes?: MapStrokeDto[];

    @IsOptional()
    @IsString()
    hash?: string;
}

/* ------------------------------------------------------------------- chapter */

export class UpdateChapterDto {
    @IsOptional()
    @IsString()
    @MaxLength(300)
    title?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20_000)
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    location?: string;

    @IsOptional()
    @IsString()
    hash?: string;
}

export class SetTimeDto {
    /** Seconds since the story epoch — `Time`'s own unit, so nothing has to parse a date here. */
    @IsInt()
    @Min(0)
    start!: number;

    @IsInt()
    @Min(0)
    end!: number;

    @IsOptional()
    @IsString()
    hash?: string;
}

/**
 * `PUT /api/entity/:kind/:id`.
 *
 * `fields` is an open map because the editable set is per *kind* and is declared by
 * `EntityService`, not by a decorator — there is no single DTO shape that describes "whatever a
 * chapter may have". The server checks each key against that kind's allow-list and refuses the
 * whole request with a `422` naming the offender, which is a better failure than a pipe
 * stripping the field and the author wondering why nothing saved.
 */
export class UpdateEntityDto {
    @IsOptional()
    @IsString()
    hash?: string;

    @IsObject()
    fields!: Record<string, string | number | boolean>;
}

/** One change to one property of a type alias (VISUALIZER_PLAN §7 Phase 10). */
export class StructureEditDto {
    @IsIn(['add', 'update', 'remove'])
    action!: 'add' | 'update' | 'remove';

    @IsString()
    @MaxLength(80)
    name!: string;

    /** Source text of the declared type. Required for `add`; optional for `update`. */
    @IsOptional()
    @IsString()
    @MaxLength(500)
    type?: string;

    @IsOptional()
    @IsBoolean()
    optional?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    doc?: string;
}

export class UpdateStructureDto {
    @IsOptional()
    @IsString()
    hash?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => StructureEditDto)
    edits!: StructureEditDto[];
}

/**
 * `PUT /api/chapter/:chapterId/layout` — passage positions (§4.4, §5.3).
 *
 * The map is `{ [passageId]: TPoint }`, which `class-validator` cannot describe with decorators
 * (there is no "validate every value of this record"), so it is typed loosely here and checked
 * in the controller. That is the honest place for it: the check needs the *story* — whether each
 * key names a real passage — which no decorator can know.
 */
export class UpdateLayoutDto {
    @IsOptional()
    @IsString()
    hash?: string;

    /**
     * `@IsObject()` is load-bearing, not decorative: the global pipe runs with `whitelist` +
     * `forbidNonWhitelisted`, which **strips** any property carrying no validation decorator and
     * then rejects the request for containing it. An undecorated `layout` is therefore a `400`
     * on every save, not a permissive pass-through.
     *
     * The per-entry checks stay in the controller, where the story is in scope — whether a key
     * names a real passage is a question no decorator can answer.
     */
    @IsObject()
    layout!: Record<string, { x: number; y: number }>;
}
