import type { MouseEvent } from 'react';
import { styled } from '@mui/material';

type TProps = {
    dragging: boolean;
    onMouseDown: (e: MouseEvent) => void;
    width?: number;
};

export const SplitterHandle = ({
    dragging,
    onMouseDown,
    width = 8,
}: TProps) => (
    <SSplitter
        role="separator"
        aria-orientation="vertical"
        style={{ width: `${width}px` }}
        onMouseDown={onMouseDown}
        $isDragging={dragging}
    />
);

const SSplitter = styled('div')<{ $isDragging: boolean }>`
    flex-shrink: 0;
    background-color: ${({ $isDragging }) =>
        $isDragging ? 'rgba(100, 150, 255, 0.8)' : 'rgba(100, 100, 100, 0.6)'};
    cursor: col-resize;
    transition: background-color 0.2s ease;
    border-radius: 0 4px 4px 0;

    &:hover {
        background-color: rgba(100, 150, 255, 0.8);
    }

    position: relative;

    &::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 2px;
        height: 20px;
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 1px;
        box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
    }
`;
