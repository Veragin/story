import '@story/shared';
import { act } from 'react';
import { observable, runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TEngineSection } from '@story/protocol';
import { ApiEvents, createMockApi } from '../../../api';
import {
    $,
    $$,
    click,
    get,
    mountAsync,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import { settle } from '../../../stores/__tests__/mockStores';
import { EngineEditorStore } from '../EngineEditorStore';
import { EnginePage } from '../EnginePage';

describe('EnginePage', () => {
    let editor: EngineEditorStore;
    const route = observable.box<TEngineSection>('onLinkClick');

    const Harness = observer(() => (
        <EnginePage section={route.get()} editor={editor} />
    ));

    const navigate = async (section: TEngineSection) => {
        await act(async () => {
            runInAction(() => route.set(section));
            await settle();
        });
    };

    beforeEach(async () => {
        const events = new ApiEvents({ createEventSource: undefined });
        editor = new EngineEditorStore({
            api: createMockApi({ events }),
            events,
        });
        runInAction(() => route.set('onLinkClick'));
        await mountAsync(<Harness />);
        await act(settle);
    });

    afterEach(() => unmount());

    it('lists both settings, the missing one as the default', () => {
        expect($$('[data-name]').map((el) => el.dataset.name)).toEqual([
            'onLinkClick',
            'topbar',
        ]);
        expect(get('[data-name="onLinkClick"]').textContent).toContain(
            'default'
        );
        expect(get('[data-name="topbar"]').textContent).toContain(
            'Health of the main character'
        );
    });

    it('follows the route with the selection and the editor', async () => {
        expect(
            get('[data-name="onLinkClick"]').classList.contains('Mui-selected')
        ).toBe(true);
        expect(get('h2').textContent).toBe('On link click');
        expect($('[data-action="implement"]')).not.toBeNull();
        expect($('[data-code-editor]')).toBeNull();

        await navigate('topbar');
        expect(
            get('[data-name="topbar"]').classList.contains('Mui-selected')
        ).toBe(true);
        expect(
            get('[data-name="onLinkClick"]').classList.contains('Mui-selected')
        ).toBe(false);
        expect(get('h2').textContent).toBe('Topbar');
        expect($('[data-code-editor]')).not.toBeNull();
    });

    it('opens the code with the starter on "Implement manually"', () => {
        click('[data-action="implement"]');
        expect($('[data-code-editor]')).not.toBeNull();
        expect(editor.resource.dirty).toBe(true);
        expect(get<HTMLButtonElement>('[data-action="save"]').disabled).toBe(
            false
        );
    });
});
