import React, { useState, useCallback, useRef, useEffect } from 'react';
import { styled } from '@mui/material';

type Props = {
    leftContent: React.ReactNode;
    rightContent: React.ReactNode;
    initialLeftWidth?: number; // as percentage (0-100)
    minLeftWidth?: number; // as percentage
    maxLeftWidth?: number; // as percentage
    splitterWidth?: number; // in pixels
};

export const ResizableSplitter = ({
    leftContent,
    rightContent,
    initialLeftWidth = 75,
    minLeftWidth = 20,
    maxLeftWidth = 80,
    splitterWidth = 8,
}: Props) => {
    const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDragging || !containerRef.current) return;

            const containerRect = containerRef.current.getBoundingClientRect();
            const containerWidth = containerRect.width;
            const mouseX = e.clientX - containerRect.left;

            const newLeftWidth = Math.min(
                Math.max((mouseX / containerWidth) * 100, minLeftWidth),
                maxLeftWidth
            );

            setLeftWidth(newLeftWidth);
        },
        [isDragging, minLeftWidth, maxLeftWidth]
    );

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <SContainer ref={containerRef}>
            <SBackgroundPanel>{leftContent}</SBackgroundPanel>
            <SOverlayPanel
                style={{ width: `${100 - leftWidth}%` }}
                ref={containerRef}
            >
                <SSplitter
                    style={{ width: `${splitterWidth}px` }}
                    onMouseDown={handleMouseDown}
                    $isDragging={isDragging}
                />
                <SRightContent>{rightContent}</SRightContent>
            </SOverlayPanel>
        </SContainer>
    );
};

const SContainer = styled('div')`
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
`;

/**
 * The left pane is a real flex sibling, not a full-width underlay.
 *
 * It used to be `position: absolute; width: 100%`, with the right pane floating over it. For a
 * form that is 95% opaque that bought nothing, and it cost the left pane its real width: a
 * canvas sized from `clientWidth` came out as wide as the whole window, so "fit the graph on
 * screen" framed the content across an area a third of which was behind the form.
 *
 * `min-width: 0` is load-bearing — without it a flex item refuses to shrink below its content's
 * intrinsic width, and a canvas reports that as its attribute width, which is exactly the
 * feedback loop that would keep the pane too wide.
 */
const SBackgroundPanel = styled('div')`
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

const SOverlayPanel = styled('div')`
    height: 100%;
    display: flex;
    flex: 0 0 auto;
`;

const SRightContent = styled('div')`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: rgba(30, 30, 30, 0.95);
    backdrop-filter: blur(8px);
    border-left: 1px solid rgba(100, 100, 100, 0.3);
    box-shadow: -4px 0 12px rgba(0, 0, 0, 0.3);
`;

const SSplitter = styled('div')<{ $isDragging: boolean }>`
    background-color: ${({ $isDragging }) =>
        $isDragging ? 'rgba(100, 150, 255, 0.8)' : 'rgba(100, 100, 100, 0.6)'};
    cursor: col-resize;
    transition: background-color 0.2s ease;
    border-radius: 0 4px 4px 0;

    &:hover {
        background-color: rgba(100, 150, 255, 0.8);
    }

    /* Add a visual indicator */
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
