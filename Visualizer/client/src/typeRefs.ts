import type { TTypeRef } from '@story/visualizer-protocol';

export const LOCAL_CHARACTER_TYPE: TTypeRef = {
    t: 'object',
    fields: [
        { key: 'name', type: { t: 'string' }, optional: false },
        { key: 'description', type: { t: 'string' }, optional: false },
    ],
};
