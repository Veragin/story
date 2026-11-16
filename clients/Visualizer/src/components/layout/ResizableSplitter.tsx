import React, { useState, useRef } from 'react';
import { styled } from '@mui/material';
import { SplitterHandle } from './SplitterHandle';
import { useDragResize } from './useDragResize';

type TProps = {
    leftContent: React.ReactNode;
    rightContent: React.ReactNode;
    initialLeftWidth?: number;
    minLeftWidth?: number;
    maxLeftWidth?: number;
    splitterWidth?: number;
};

export const ResizableSplitter = ({
    leftContent,
    rightContent,
    initialLeftWidth = 75,
    minLeftWidth = 20,
    maxLeftWidth = 80,
    splitterWidth = 8,
}: TProps) => {
    const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
    const containerRef = useRef<HTMLDivElement>(null);

    const { dragging, startDrag } = useDragResize((clientX) => {
        if (!containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const mouseX = clientX - containerRect.left;

        const newLeftWidth = Math.min(
            Math.max((mouseX / containerWidth) * 100, minLeftWidth),
            maxLeftWidth
        );

        setLeftWidth(newLeftWidth);
    });

    return (
        <SContainer ref={containerRef}>
            <SBackgroundPanel>{leftContent}</SBackgroundPanel>
            <SOverlayPanel style={{ width: `${100 - leftWidth}%` }}>
                <SplitterHandle
                    width={splitterWidth}
                    onMouseDown={startDrag}
                    dragging={dragging}
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

const SBackgroundPanel = styled('div')`
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

const SOverlayPanel = styled('div')`
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    display: flex;
    z-index: 10;
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
