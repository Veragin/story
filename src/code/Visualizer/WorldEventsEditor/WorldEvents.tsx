/// <reference path="../../../@types/global.d.ts" />
import React, { useEffect, useRef } from 'react';
import { styled, useTheme } from '@mui/material';
import { useVisualizerStore } from '../../Context';
import { VisualObject } from '../GUIComponents/Canvas/Node/VisualObject';
import { HoverableVisualObject } from '../GUIComponents/Canvas/Node/HoverableVisualObject';
import { ClickableVisualObject } from '../GUIComponents/Canvas/Node/ClickableVisualObject';
import { DraggableVisualObject } from '../GUIComponents/Canvas/Node/DraggableVisualObject';
import { PanableCanvasManager } from '../GUIComponents/Canvas/CanvasManager/PanableCanvasManager';
import { Button } from '@mui/material';

// Create a simple navigation bar with theme colors
const NavBar = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 16px',
  backgroundColor: theme.palette.primary.dark, // #000814
  borderBottom: `1px solid ${theme.palette.primary.main}`, // #003566
  minHeight: '48px',
}));

const Title = styled('h2')(({ theme }) => ({
  margin: '0 16px',
  color: theme.palette.secondary.main, // #ffc300
  fontSize: '1.25rem',
  fontWeight: 500,
}));

const StyledCanvasEl = styled('canvas')(({ theme }) => ({
  display: 'block',
  background: theme.palette.background.default, // #000814
}));

// Example visual objects implementation using theme colors
class RectangleVisual extends VisualObject {
    constructor(position: TPoint, size: TSize, private color: string, zIndex: number = 0) {
        super(position, size, zIndex);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.position.x, this.position.y, this.size.width, this.size.height);
    }
}

class CircleVisual extends VisualObject {
    constructor(position: TPoint, private radius: number, private color: string, zIndex: number = 0) {
        super(position, { width: radius * 2, height: radius * 2 }, zIndex);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.position.x + this.radius, this.position.y + this.radius, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class HoverableRectangle extends HoverableVisualObject {
    constructor(position: TPoint, size: TSize, private defaultColor: string, private hoverColor: string, zIndex: number = 0) {
        super(position, size, zIndex);

        this.onHoverEnter.subscribe(() => {
            console.log('Rectangle hovered');
        });

        this.onHoverExit.subscribe(() => {
            console.log('Rectangle hover exited');
        });
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = this.isHovered() ? this.hoverColor : this.defaultColor;
        ctx.fillRect(this.position.x, this.position.y, this.size.width, this.size.height);
    }
}

class ClickableCircle extends ClickableVisualObject {
    constructor(position: TPoint, radius: number, private defaultColor: string, private clickColor: string, zIndex: number = 0) {
        super(position, { width: radius * 2, height: radius * 2 }, zIndex);

        this.onClick.subscribe(() => {
            console.log('Circle clicked');
        });
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = this.defaultColor;
        ctx.beginPath();
        ctx.arc(this.position.x + this.size.width / 2, this.position.y + this.size.height / 2, this.size.width / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

class DraggableBox extends DraggableVisualObject {
    constructor(position: TPoint, size: TSize, private color: string, zIndex: number = 0) {
        super(position, size, zIndex);

        this.onDragStart.subscribe((event) => {
            console.log('Drag started', event);
        });

        this.onDragEnd.subscribe((event) => {
            console.log('Drag ended', event);
        });
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.position.x, this.position.y, this.size.width, this.size.height);
    }
}

export const WorldEvents = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasManagerRef = useRef<PanableCanvasManager | null>(null);
    const store = useVisualizerStore();
    const theme = useTheme();

    useEffect(() => {
        if (!canvasRef.current) return;

        // Initialize canvas manager with panning capabilities
        canvasManagerRef.current = new PanableCanvasManager(canvasRef.current);
        const canvasManager = canvasManagerRef.current;

        // Set canvas size
        const resizeCanvas = () => {
            if (!canvasRef.current) return;
            const container = canvasRef.current.parentElement;
            if (!container) return;

            canvasRef.current.width = container.clientWidth;
            canvasRef.current.height = container.clientHeight;
            canvasManager.draw();
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Add example visual objects using theme colors
        const staticRect = new RectangleVisual(
            { x: 50, y: 50 }, 
            { width: 100, height: 80 }, 
            theme.palette.primary.main // #003566
        );
        canvasManager.addObject(staticRect);

        const staticCircle = new CircleVisual(
            { x: 200, y: 80 }, 
            40, 
            theme.palette.secondary.main // #ffc300
        );
        canvasManager.addObject(staticCircle);

        const hoverableRect = new HoverableRectangle(
            { x: 300, y: 50 },
            { width: 120, height: 60 },
            theme.palette.secondary.light, // #ffd60a
            theme.palette.secondary.main  // #ffc300
        );
        canvasManager.addObject(hoverableRect);

        const clickableCircle = new ClickableCircle(
            { x: 450, y: 80 },
            35,
            theme.palette.primary.light, // #001d3d
            theme.palette.primary.main   // #003566
        );
        canvasManager.addObject(clickableCircle);

        const draggableBox = new DraggableBox(
            { x: 550, y: 50 },
            { width: 100, height: 70 },
            theme.palette.secondary.main // #ffc300
        );
        canvasManager.addObject(draggableBox);

        // Clean up
        return () => {
            window.removeEventListener('resize', resizeCanvas);
            canvasManagerRef.current?.dispose();
        };
    }, [theme]);

    return (
        <StyledContainer>
            <NavBar>
                <Button
                    color="inherit"
                    variant="text"
                    onClick={() => store.setActiveTab(null)}
                    sx={{ color: 'white' }}
                >
                    Back
                </Button>
                <Title>World Events (Pan & Zoom Enabled)</Title>
            </NavBar>
            <CanvasContainer>
                <StyledCanvasEl ref={canvasRef} />
            </CanvasContainer>
        </StyledContainer>
    );
};

// Use theme colors for the container
const StyledContainer = styled('div')(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: theme.palette.background.default, // #000814
}));

const CanvasContainer = styled('div')({
    flex: 1,
    overflow: 'hidden',
});