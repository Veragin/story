import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it } from 'vitest';
import { $, $$, get, mount, unmount } from '../../inputs/__tests__/dom';
import { DiagnosticsList } from '../DiagnosticsList';

describe('DiagnosticsList', () => {
    afterEach(unmount);

    it('renders nothing without diagnostics', () => {
        mount(<DiagnosticsList diagnostics={[]} title="Not saved" />);
        expect($('[data-notice="diagnostics"]')).toBeNull();
    });

    it('lists each diagnostic in the shared format with its field', () => {
        mount(
            <DiagnosticsList
                title="Not saved"
                diagnostics={[
                    { file: 'a.ts', line: 3, column: 7, message: 'Bad', code: 2322, field: 'name' },
                    { file: 'b.ts', line: 1, column: 2, message: 'Nope' },
                ]}
            />
        );
        expect(get('[data-notice="diagnostics"] .MuiAlertTitle-root').textContent).toBe('Not saved');
        expect($$('[data-notice="diagnostics"] li').map((li) => li.textContent)).toEqual([
            'a.ts:3:7 TS2322: Bad [name]',
            'b.ts:1:2 Nope',
        ]);
    });
});
