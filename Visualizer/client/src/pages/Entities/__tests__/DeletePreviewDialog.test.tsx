import '@story/shared';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TDeleteReferencesDto } from '@story/visualizer-protocol';
import {
    click,
    get,
    mountAsync,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import { DeletePreviewDialog } from '../DeletePreviewDialog';

const CLEARED: TDeleteReferencesDto['cleared'] = [
    {
        file: 'data/characters/thomas.ts',
        line: 4,
        resource: { kind: 'entity', id: 'characters/thomas' },
        path: 'race',
        change: { op: 'removed' },
    },
    {
        file: 'data/chapters/village/village.chapter.ts',
        line: 9,
        resource: { kind: 'chapter', id: 'village' },
        path: 'location',
        change: { op: 'set', value: 'kingdom' },
    },
];

describe('DeletePreviewDialog', () => {
    afterEach(unmount);

    const render = async (preview: TDeleteReferencesDto) => {
        const onAnswer = vi.fn<(answer: boolean) => void>();
        await mountAsync(
            <DeletePreviewDialog
                title="Delete elf?"
                message="This removes it."
                preview={() => Promise.resolve(preview)}
                onAnswer={onAnswer}
            />
        );
        await act(() => Promise.resolve());
        return onAnswer;
    };

    it('lists the values the delete clears and confirms', async () => {
        const onAnswer = await render({ cleared: CLEARED, blocking: [] });
        expect(get('[data-preview="cleared"]').textContent).toContain(
            'characters/thomas race: removed'
        );
        expect(get('[data-preview="cleared"]').textContent).toContain(
            'chapter village location: set to "kingdom"'
        );
        click('[data-action="confirm-delete"]');
        expect(onAnswer).toHaveBeenCalledWith(true);
    });

    it('disables the delete while code still references it', async () => {
        await render({
            cleared: [],
            blocking: [
                {
                    file: 'data/chapters/palace.ts',
                    line: 3,
                    text: "race: 'elf'",
                },
            ],
        });
        expect(get('[data-preview="blocking"]').textContent).toContain(
            "data/chapters/palace.ts:3 race: 'elf'"
        );
        expect(
            get<HTMLButtonElement>('[data-action="confirm-delete"]').disabled
        ).toBe(true);
    });
});
