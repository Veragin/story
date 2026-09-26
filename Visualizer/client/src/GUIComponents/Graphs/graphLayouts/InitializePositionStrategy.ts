import { NodeVisualObject } from '../NodeVisualObject';
import { EdgeVisualObject } from '../EdgeVisualObject';

export interface InitializePositionStrategy {
    initializePositions(nodes: NodeVisualObject[], edges: EdgeVisualObject[], width: number, height: number): void;
}

export class CircularInitializePositionStrategy implements InitializePositionStrategy {
    initializePositions(nodes: NodeVisualObject[], edges: EdgeVisualObject[], width: number, height: number): void {
        void edges;
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length;
            const radius = Math.min(width, height) / 3;
            const x = width / 2 + radius * Math.cos(angle);
            const y = height / 2 + radius * Math.sin(angle);
            node.setPosition({ x, y });
        });
    }
}
