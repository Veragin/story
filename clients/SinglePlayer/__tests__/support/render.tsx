import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createWorldState } from '@story/core';
import type { TEngineSettings } from '@story/types';
import { engine, itemInfo, register } from '@story/data';
import { Wrapper } from '../../src/Wrapper';

export const TEST_STORY_ID = 'example';

export const newSession = (engineSettings: TEngineSettings = engine) =>
    createWorldState({ register, itemInfo, engine: engineSettings }, TEST_STORY_ID);

type TSession = ReturnType<typeof newSession>;

let mounted: { root: Root; container: HTMLElement } | null = null;

export const renderWithSession = ({ s, e }: TSession, node: ReactNode): HTMLElement => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted = { root, container };
    act(() =>
        root.render(
            <Wrapper s={s} e={e}>
                {node}
            </Wrapper>
        )
    );
    return container;
};

export const unmount = () => {
    if (mounted === null) return;
    const { root, container } = mounted;
    act(() => root.unmount());
    container.remove();
    mounted = null;
};

export const buttonByText = (container: HTMLElement, text: string): HTMLButtonElement | undefined =>
    [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
