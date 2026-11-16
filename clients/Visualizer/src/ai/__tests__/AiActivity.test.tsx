import '@story/shared';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { $$, get, mount, unmount } from '../../components/inputs/__tests__/dom';
import { AiActivity } from '../AiActivity';

const FILES = ['data/a.ts', 'data/b.ts', 'data/c.ts', 'data/d.ts', 'data/e.ts'];

describe('AiActivity', () => {
    afterEach(unmount);

    it('says the agent is idle when ready', () => {
        mount(<AiActivity status="ready" message={null} touchedFiles={[]} />);
        expect(document.body.textContent).toBe('Agent is idle');
    });

    it('warns while working and lists the touched files, collapsed after 3', () => {
        mount(<AiActivity status="busy" message={null} touchedFiles={FILES} />);
        const text = document.body.textContent ?? '';
        expect(text).toContain('Agent is working');
        expect(text).toContain(
            "Don't edit the files it is changing until it finishes"
        );
        expect($$('code').map((c) => c.textContent)).toEqual(FILES.slice(0, 3));

        const more = get('button');
        expect(more.textContent).toBe('2 more');
        act(() => more.click());
        expect($$('code').map((c) => c.textContent)).toEqual(FILES);
    });

    it('shows the warning without files while starting', () => {
        mount(
            <AiActivity status="starting" message={null} touchedFiles={[]} />
        );
        expect(document.body.textContent).toContain("Don't edit the files");
        expect($$('code')).toHaveLength(0);
    });

    it('shows the reason when stopped or failed', () => {
        mount(
            <AiActivity
                status="stopped"
                message="The story folder was replaced"
                touchedFiles={[]}
            />
        );
        expect(document.body.textContent).toBe('The story folder was replaced');
        unmount();
        mount(<AiActivity status="error" message={null} touchedFiles={[]} />);
        expect(document.body.textContent).toContain('The agent failed');
    });
});
