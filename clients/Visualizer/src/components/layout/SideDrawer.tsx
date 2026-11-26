import { useRef, useState, type ReactNode } from 'react';
import { styled } from '@mui/material';
import { getUiState, setUiState } from '../../ui-state';
import { SplitterHandle } from './SplitterHandle';
import { useDragResize } from './useDragResize';

const WIDTH_KEY = 'sideDrawerWidth';
const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 320;
const MAX_WIDTH_SHARE = 0.85;

const clampWidth = (width: number, containerWidth: number) =>
    Math.round(
        Math.min(
            Math.max(width, MIN_WIDTH),
            Math.max(MIN_WIDTH, containerWidth * MAX_WIDTH_SHARE)
        )
    );

const savedWidth = () => {
    const saved = getUiState<unknown>(WIDTH_KEY, DEFAULT_WIDTH);
    return typeof saved === 'number' ? saved : DEFAULT_WIDTH;
};

type TProps = {
    children: ReactNode;
};

export const SideDrawer = ({ children }: TProps) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(savedWidth);

    const { dragging, startDrag } = useDragResize((clientX) => {
        const container =
            rootRef.current?.parentElement?.getBoundingClientRect();
        if (!container) return;
        const next = clampWidth(container.right - clientX, container.width);
        setWidth(next);
        setUiState(WIDTH_KEY, next);
    });

    return (
        <SRoot ref={rootRef} style={{ width }}>
            <SplitterHandle dragging={dragging} onMouseDown={startDrag} />
            <SContent>{children}</SContent>
        </SRoot>
    );
};

const SRoot = styled('div')`
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    display: flex;
    min-width: min(${MIN_WIDTH}px, 100%);
    max-width: ${MAX_WIDTH_SHARE * 100}%;
`;

const SContent = styled('div')(({ theme }) => ({
    flex: 1,
    minWidth: 0,
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    color: theme.palette.text.primary,
    fontSize: theme.typography.small.fontSize,
    backgroundColor: theme.palette.surface.overlay,
    borderLeft: `1px solid ${theme.palette.border.strong}`,
}));
