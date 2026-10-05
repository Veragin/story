import type { TClearedReferenceDto } from '@story/visualizer-protocol';

const changeText = ({ change }: TClearedReferenceDto): string => {
    if (change.op === 'removed') return _('removed');
    return change.value === null ? _('set to undefined') : _('set to "%s"', change.value);
};

// entity ids already name their kind: `characters/thomas`
const holderText = ({ resource }: TClearedReferenceDto): string =>
    resource.kind === 'entity' ? resource.id : `${resource.kind} ${resource.id}`;

export const clearedText = (ref: TClearedReferenceDto): string => `${holderText(ref)} ${ref.path}: ${changeText(ref)}`;
