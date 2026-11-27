import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';

export const useDragResize = (onMove: (clientX: number) => void) => {
    const [dragging, setDragging] = useState(false);
    const onMoveRef = useRef(onMove);
    onMoveRef.current = onMove;

    const startDrag = useCallback((e: MouseEvent) => {
        e.preventDefault();
        setDragging(true);
    }, []);

    useEffect(() => {
        if (!dragging) return;
        const move = (e: globalThis.MouseEvent) => onMoveRef.current(e.clientX);
        const stop = () => setDragging(false);
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        return () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', stop);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [dragging]);

    return { dragging, startDrag };
};
