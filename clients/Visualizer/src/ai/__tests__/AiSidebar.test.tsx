import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TAiMessageDto } from '@story/protocol';
import { createMockApi } from '../../api';
import {
    $,
    $$,
    get,
    mount,
    unmount,
} from '../../components/inputs/__tests__/dom';
import { AiSidebar } from '../AiSidebar';
import { AiStore } from '../AiStore';

const AT = '2026-01-01T00:00:00Z';

const MESSAGES: TAiMessageDto[] = [
    { kind: 'user', id: '1', text: 'Add a passage', at: AT },
    { kind: 'assistant', id: '3', text: 'Done.\nIt links back.', at: AT },
    { kind: 'system', id: '4', text: 'Credits left: 4', at: AT },
];

describe('AiSidebar', () => {
    let store: AiStore;

    const snapshot = (credits: number, messages: TAiMessageDto[] = []) =>
        act(() =>
            store.applyEvent({
                type: 'snapshot',
                status: 'ready',
                credits,
                sessionId: null,
                messages,
                touchedFiles: [],
            })
        );

    beforeEach(() => {
        store = new AiStore({ api: createMockApi() });
    });

    afterEach(unmount);

    it('renders one entry per message kind, with the header and the activity bar', () => {
        mount(<AiSidebar store={store} />);
        snapshot(5, MESSAGES);
        expect(
            $$('[role=log] [data-kind]').map((el) => el.dataset.kind)
        ).toEqual(['user', 'assistant', 'system']);
        expect(get('[data-kind=assistant]').textContent).toBe(
            'Done.\nIt links back.'
        );
        const text = document.body.textContent ?? '';
        expect(text).toContain('Ai agent');
        expect(text).toContain('5 credits');
        expect(text).toContain('Agent is idle');
        expect($('[role=alert]')).toBeNull();
    });

    it('shows the no-credits alert and locks the input', () => {
        mount(<AiSidebar store={store} />);
        snapshot(0);
        expect(get('[role=alert]').textContent).toContain('no AI credits left');
        expect(get<HTMLTextAreaElement>('textarea').disabled).toBe(true);
    });

    it('closes from the header', () => {
        store.setOpen(true);
        mount(<AiSidebar store={store} />);
        act(() => get('button[aria-label="Close"]').click());
        expect(store.open).toBe(false);
    });
});
