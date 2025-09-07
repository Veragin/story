import React, { useEffect, useRef, useState } from 'react';
import { styled, useTheme } from '@mui/material';
import { useVisualizerStore } from '../../Context';
import { VisualObject } from '../GUIComponents/Canvas/Node/VisualObject';
import { HoverableVisualObject } from '../GUIComponents/Canvas/Node/HoverableVisualObject';
import { ClickableVisualObject } from '../GUIComponents/Canvas/Node/ClickableVisualObject';
import { DraggableVisualObject } from '../GUIComponents/Canvas/Node/DraggableVisualObject';
import { Button, ButtonGroup, Typography, Box, Chip } from '@mui/material';
import { ZoomIn, ZoomOut, CenterFocusStrong, RestartAlt } from '@mui/icons-material';
import { MouseButton } from '../GUIComponents/Canvas/CanvasManager/InputConstants';
import { CanvasManagerCore } from '../GUIComponents/Canvas/CanvasManager/CanvasManagerCore';
import { CanvasManagerBuilder } from '../GUIComponents/Canvas/CanvasManager/CanvasManagerBuilder';
import { PanningPlugin } from '../GUIComponents/Canvas/Plugins/PanningPlugin';
import { ZoomingPlugin, IZoomingControls } from '../GUIComponents/Canvas/Plugins/ZoomingPlugin';
import { HoveringPlugin } from '../GUIComponents/Canvas/Plugins/HoveringPlugin';
import { DraggingPlugin } from '../GUIComponents/Canvas/Plugins/DraggingPlugin';
import { ClickingPlugin } from '../GUIComponents/Canvas/Plugins/ClickingPlugin';

// Create a navigation bar with theme colors and zoom controls
const NavBar = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 16px',
  backgroundColor: theme.palette.primary.dark, // #000814
  borderBottom: `1px solid ${theme.palette.primary.main}`, // #003566
  minHeight: '48px',
  gap: '16px',
}));

const Title = styled('h2')(({ theme }) => ({
  margin: 0,
  color: theme.palette.secondary.main, // #ffc300
  fontSize: '1.25rem',
  fontWeight: 500,
  flex: 1,
}));

const ZoomControls = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  color: 'white',
}));

const StyledCanvasEl = styled('canvas')(({ theme }) => ({
  display: 'block',
  background: theme.palette.background.default, // #000814
  cursor: 'default',
}));

const InstructionsOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: '16px',
  right: '16px',
  backgroundColor: 'rgba(0, 8, 20, 0.9)',
  border: `1px solid ${theme.palette.primary.main}`,
  borderRadius: '8px',
  padding: '12px',
  color: theme.palette.secondary.main,
  fontSize: '0.875rem',
  maxWidth: '300px',
  zIndex: 1000,
}));

// Example visual objects implementation using theme colors
class RectangleVisual extends VisualObject {
    constructor(position: TPoint, size: TSize, private color: string, zIndex: number = 0) {
        super(position, size, zIndex);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.position.x, this.position.y, this.size.width, this.size.height);
        
        // Add a border for better visibility
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.position.x, this.position.y, this.size.width, this.size.height);
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
        
        // Add a border for better visibility
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
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
        
        // Add a border
        ctx.strokeStyle = this.isHovered() ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = this.isHovered() ? 2 : 1;
        ctx.strokeRect(this.position.x, this.position.y, this.size.width, this.size.height);
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
        
        // Add a border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
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
        
        // Add a border and drag indicator
        ctx.strokeStyle = this.isDragging() ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = this.isDragging() ? 2 : 1;
        ctx.strokeRect(this.position.x, this.position.y, this.size.width, this.size.height);
        
        // Add drag icon in center
        if (!this.isDragging()) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⋮⋮', this.position.x + this.size.width / 2, this.position.y + this.size.height / 2 + 5);
        }
    }
}

export const WorldEvents = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const managerRef = useRef<ReturnType<typeof CanvasManagerBuilder.prototype.build> | null>(null);
    const zoomControlsRef = useRef<IZoomingControls | null>(null);
    const store = useVisualizerStore();
    const theme = useTheme();
    
    // State for zoom information display
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [isZooming, setIsZooming] = useState<boolean>(false);
    const [showInstructions, setShowInstructions] = useState<boolean>(true);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Initialize plugins
        const panPlugin = new PanningPlugin({
            enableKeyboardPan: true,
            enableMousePan: true,
            panMouseButton: MouseButton.RIGHT,
        });

        const zoomPlugin = new ZoomingPlugin({
            enableWheelZoom: true,
            enableKeyboardZoom: true,
            zoomAtCursor: true,
            smoothZooming: true,
            zoomSmoothingFactor: 0.15,
            zoomFactor: 1.15,
            maxZoom: 5,
            minZoom: 0.2,
        });

        // Build canvas manager
        const builder = new CanvasManagerBuilder(canvasRef.current);
        builder.addPlugin(panPlugin);
        builder.addPlugin(zoomPlugin);
        builder.addPlugin(new HoveringPlugin());
        builder.addPlugin(new DraggingPlugin());
        builder.addPlugin(new ClickingPlugin());
        const manager = builder.build();
        managerRef.current = manager;
        const core = manager.core;

        // Get controls
        zoomControlsRef.current = manager.getPluginControls<IZoomingControls>("ZoomingPlugin") ?? null;

        // Set canvas size with high-DPI support
        const resizeCanvas = () => {
            if (!canvasRef.current) return;
            const container = canvasRef.current.parentElement;
            if (!container) return;

            const dpr = window.devicePixelRatio || 1;
            const cssWidth = container.clientWidth;
            const cssHeight = container.clientHeight;

            canvasRef.current.width = cssWidth * dpr;
            canvasRef.current.height = cssHeight * dpr;
            canvasRef.current.style.width = `${cssWidth}px`;
            canvasRef.current.style.height = `${cssHeight}px`;

            // Update visibility manager with logical size
            core.visibleVisualObjectsManager.setCanvasSize({ width: cssWidth, height: cssHeight });

            core.requestRedraw();
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Create a more diverse scene to showcase zoom capabilities
        // Background grid pattern
        for (let x = 0; x < 2000; x += 200) {
            for (let y = 0; y < 1500; y += 200) {
                const gridRect = new RectangleVisual(
                    { x: x + 10, y: y + 10 },
                    { width: 180, height: 180 },
                    'rgba(0, 53, 102, 0.1)' // Very faint primary color
                );
                core.addObject(gridRect);
            }
        }

        // Main visual objects
        const staticRect = new RectangleVisual(
            { x: 50, y: 50 }, 
            { width: 100, height: 80 }, 
            theme.palette.primary.main // #003566
        );
        core.addObject(staticRect);

        const staticCircle = new CircleVisual(
            { x: 200, y: 80 }, 
            40, 
            theme.palette.secondary.main // #ffc300
        );
        core.addObject(staticCircle);

        const hoverableRect = new HoverableRectangle(
            { x: 300, y: 50 },
            { width: 120, height: 60 },
            theme.palette.secondary.light, // #ffd60a
            theme.palette.secondary.main  // #ffc300
        );
        core.addObject(hoverableRect);

        const clickableCircle = new ClickableCircle(
            { x: 450, y: 80 },
            35,
            theme.palette.primary.light, // #001d3d
            theme.palette.primary.main   // #003566
        );
        core.addObject(clickableCircle);

        const draggableBox = new DraggableBox(
            { x: 550, y: 50 },
            { width: 100, height: 70 },
            theme.palette.secondary.main // #ffc300
        );
        core.addObject(draggableBox);

        // Add some scattered objects for zoom testing
        const colors = [theme.palette.primary.main, theme.palette.secondary.main, theme.palette.primary.light];
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * 1800 + 100;
            const y = Math.random() * 1300 + 200;
            const size = Math.random() * 50 + 20;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            if (Math.random() > 0.5) {
                const rect = new RectangleVisual(
                    { x, y },
                    { width: size, height: size * 0.7 },
                    color
                );
                core.addObject(rect);
            } else {
                const circle = new CircleVisual(
                    { x, y },
                    size / 2,
                    color
                );
                core.addObject(circle);
            }
        }

        // Update zoom level display
        const updateZoomDisplay = () => {
            setZoomLevel(zoomControlsRef.current?.getZoomLevel() ?? 1);
            setIsZooming(zoomControlsRef.current?.isCurrentlyZooming() ?? false);
        };

        // Set up a timer to update zoom display
        const zoomUpdateInterval = setInterval(updateZoomDisplay, 16); // ~60fps

        // Clean up
        return () => {
            clearInterval(zoomUpdateInterval);
            window.removeEventListener('resize', resizeCanvas);
            managerRef.current?.destroy();
        };
    }, [theme]);

    // Zoom control handlers
    const handleZoomIn = () => {
        zoomControlsRef.current?.zoomIn();
    };

    const handleZoomOut = () => {
        zoomControlsRef.current?.zoomOut();
    };

    const handleResetZoom = () => {
        zoomControlsRef.current?.resetZoom();
    };

    const handleResetView = () => {
        zoomControlsRef.current?.resetZoom();
        managerRef.current?.core.canvasWorld.resetViewPosition();
    };

    const handleFitToRect = () => {
        // Fit to a specific area of interest
        zoomControlsRef.current?.fitToRect({
            x: 0,
            y: 0,
            width: 800,
            height: 400
        }, 50);
    };

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
                
                <ZoomControls>
                    <Typography variant="body2">
                        Zoom: {(zoomLevel * 100).toFixed(0)}%
                    </Typography>
                    
                    {isZooming && (
                        <Chip 
                            label="Zooming" 
                            size="small" 
                            color="secondary"
                            sx={{ fontSize: '0.7rem' }}
                        />
                    )}
                    
                    <ButtonGroup size="small" variant="outlined" sx={{ color: 'white' }}>
                        <Button onClick={handleZoomOut} title="Zoom Out">
                            <ZoomOut fontSize="small" />
                        </Button>
                        <Button onClick={handleResetZoom} title="Reset Zoom">
                            <CenterFocusStrong fontSize="small" />
                        </Button>
                        <Button onClick={handleZoomIn} title="Zoom In">
                            <ZoomIn fontSize="small" />
                        </Button>
                    </ButtonGroup>
                    
                    <ButtonGroup size="small" variant="outlined" sx={{ color: 'white' }}>
                        <Button onClick={handleFitToRect} title="Fit to Area" sx={{ fontSize: '0.75rem' }}>
                            Fit
                        </Button>
                        <Button onClick={handleResetView} title="Reset View">
                            <RestartAlt fontSize="small" />
                        </Button>
                    </ButtonGroup>
                    
                    <Button 
                        size="small" 
                        variant="text" 
                        onClick={() => setShowInstructions(!showInstructions)}
                        sx={{ color: 'white', fontSize: '0.75rem' }}
                    >
                        {showInstructions ? 'Hide' : 'Show'} Help
                    </Button>
                </ZoomControls>
            </NavBar>
            
            <CanvasContainer>
                <StyledCanvasEl ref={canvasRef} />
                
                {showInstructions && (
                    <InstructionsOverlay>
                        <Typography variant="subtitle2" gutterBottom>
                            🎮 Controls:
                        </Typography>
                        <Typography variant="body2" component="div">
                            <strong>Zoom:</strong><br/>
                            • Mouse wheel to zoom in/out<br/>
                            • +/= or Z to zoom in<br/>
                            • -/_ or X to zoom out<br/>
                            • Numpad 5/0 or Esc to reset zoom<br/>
                            <br/>
                            <strong>Pan:</strong><br/>
                            • Right-click + drag to pan<br/>
                            • Arrow keys or WASD to pan<br/>
                            • Home or R to reset position<br/>
                            <br/>
                            <strong>Interaction:</strong><br/>
                            • Hover over rectangles<br/>
                            • Click circles<br/>
                            • Drag yellow boxes<br/>
                        </Typography>
                    </InstructionsOverlay>
                )}
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
    position: 'relative',
});