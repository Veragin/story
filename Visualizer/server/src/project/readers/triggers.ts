import type { TFunctionDto, TMaybeCode, TTriggerDto } from '@story/visualizer-protocol';
import { version } from '../../events/version';
import { lineOf } from '../ast';
import type { SourceProject } from '../SourceProject';
import { findTrigger, type TTriggerSource } from '../story';
import { readFields, S, type TField } from '../values';

export const TRIGGER_FIELDS: Record<string, TField> = {
    name: { schema: S.string },
    description: { schema: S.string },
    time: { schema: S.time },
    condition: { schema: S.fn('() => true') },
    action: { schema: S.fn() },
};

export const readTriggerSource = (sp: SourceProject, t: TTriggerSource): TTriggerDto => {
    const fields = readFields(t.obj, TRIGGER_FIELDS);
    const decl = t.sf.getVariableDeclarationOrThrow(t.exportName);
    return {
        triggerId: t.triggerId,
        chapterId: t.chapterId,
        version: version(t.sf.getFullText()),
        file: sp.root.rel(t.sf.getFilePath()),
        line: lineOf(decl),
        exportName: t.exportName,
        name: (fields.name ?? t.triggerId) as TMaybeCode<string>,
        description: (fields.description ?? '') as TMaybeCode<string>,
        time: (fields.time ?? { code: '' }) as TMaybeCode<string>,
        condition: (fields.condition ?? { code: '() => true' }) as TFunctionDto,
        action: (fields.action ?? { code: '() => {}' }) as TFunctionDto,
    };
};

export const readTrigger = (sp: SourceProject, triggerId: string): TTriggerDto =>
    readTriggerSource(sp, findTrigger(sp, triggerId));
