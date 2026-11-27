import type { ReactNode } from 'react';
import {
    ObjectViewToggle,
    type TObjectViewToggleProps,
} from './ObjectViewToggle';

// the toggle moves into the field's label row, so the editor must not draw its own
export const useViewToggle = (
    actions: ReactNode,
    toggle: TObjectViewToggleProps | null
) => ({
    actions: toggle ? (
        <>
            {actions}
            <ObjectViewToggle {...toggle} />
        </>
    ) : (
        actions
    ),
    hideViewToggle: true,
});
