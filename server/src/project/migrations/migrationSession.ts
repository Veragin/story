import { eventIds } from '@story/protocol';
import type { EventBus } from '../../events/EventBus';
import { isHttpError } from '../../common/HttpError';
import { readStructure } from '../readers/structure';
import type { EditSession, SourceProject } from '../SourceProject';

export const commitMigration = (sp: SourceProject, s: EditSession, bus: EventBus) =>
    s.commit(bus, () => ({
        kind: 'structure',
        id: eventIds.structure,
        version: readStructure(sp).version,
        op: 'updated',
    }));

export const notMigratedMessage = (sp: SourceProject, e: unknown): string => {
    const diagnostics = isHttpError(e) ? (e.body.diagnostics ?? []) : [];
    const details = diagnostics.map((d) => `\n  ${d.file}:${d.line} ${d.message}`).join('');
    return `${sp.root.storyId} not migrated: ${e instanceof Error ? e.message : String(e)}${details}`;
};
