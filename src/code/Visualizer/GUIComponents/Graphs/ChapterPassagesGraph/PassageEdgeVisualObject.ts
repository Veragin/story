import { TVisualObjectPropertyChangeArgs } from '../../Canvas/Node/VisualObject';
import { IMementoAwareListener } from '../../MementoSystem/MementoAwareObserver';
import { EdgeVisualObject, TLineType } from '../EdgeVisualObject';
import { NodeVisualObject } from '../NodeVisualObject';
import { PassageNodeVisualObject, selectableVisualProperties } from './PassageNodeVisualObject';

/**
 * Internal listener for source node selection changes
 */
class SourceNodeSelectionListener implements IMementoAwareListener<TVisualObjectPropertyChangeArgs> {
    constructor(
        private edge: PassageEdgeVisualObject,
        private sourceNode: PassageNodeVisualObject,
        public id: string
    ) {}

    getId(): string {
        return this.id;
    }

    onNotify(args: TVisualObjectPropertyChangeArgs): void {
        if (args.property === selectableVisualProperties.isSelected) {
            if (this.sourceNode.isSelected) {
                this.edge.setColor(this.edge.onSourceSelectedColor);
                this.edge.setZIndex(this.edge.zIndex + 1);
            } else {
                this.edge.setColor(this.edge.defaultColor);
                this.edge.setZIndex(this.edge.zIndex - 1);
            }
        }
    }
}

/**
 * Internal listener for target node selection changes
 */
class TargetNodeSelectionListener implements IMementoAwareListener<TVisualObjectPropertyChangeArgs> {
    constructor(
        private edge: PassageEdgeVisualObject,
        private targetNode: PassageNodeVisualObject,
        public id: string
    ) {}

    getId(): string {
        return this.id;
    }

    onNotify(args: TVisualObjectPropertyChangeArgs): void {
        if (args.property === selectableVisualProperties.isSelected) {
            if (this.targetNode.isSelected) {
                this.edge.setZIndex(this.edge.zIndex + 1);
                this.edge.setColor(this.edge.onTargetSelectedColor);
            } else {
                this.edge.setColor(this.edge.defaultColor);
                this.edge.setZIndex(this.edge.zIndex - 1);
            }
        }
    }
}

export class PassageEdgeVisualObject extends EdgeVisualObject {
    _onTargetSelectedColor: string = '#0000ff';
    _onSourceSelectedColor: string = '#ff0000';
    _defaultColor: string = '#000000';

    // Store listener references so they can be persisted
    private sourceSelectionListener?: SourceNodeSelectionListener;
    private targetSelectionListener?: TargetNodeSelectionListener;

    // Store the wrapper functions so we can unsubscribe later
    private sourceSelectionWrapper?: (args: TVisualObjectPropertyChangeArgs) => void;
    private targetSelectionWrapper?: (args: TVisualObjectPropertyChangeArgs) => void;

    set onTargetSelectedColor(color: string) {
        this._onTargetSelectedColor = color;
    }

    set onSourceSelectedColor(color: string) {
        this._onSourceSelectedColor = color;
    }

    set defaultColor(color: string) {
        this._defaultColor = color;
    }

    get onTargetSelectedColor() {
        return this._onTargetSelectedColor;
    }

    get onSourceSelectedColor() {
        return this._onSourceSelectedColor;
    }

    get defaultColor() {
        return this._defaultColor;
    }

    constructor(
        source: NodeVisualObject,
        target: NodeVisualObject,
        color: string = '#000000',
        width: number = 1,
        arrow: boolean = true,
        zIndex: number = 0,
        style: TLineType = 'solid'
    ) {
        super(source, target, color, width, arrow, zIndex, style);

        this._defaultColor = color;

        // Create and subscribe listeners for node selection changes
        const sourceNode = this.getSource() as PassageNodeVisualObject;
        const targetNode = this.getTarget() as PassageNodeVisualObject;

        // Create listeners with unique IDs (using a simple counter or timestamp since non-memento objects don't have IDs)
        const edgeId = `edge-${Date.now()}-${Math.random()}`;
        this.sourceSelectionListener = new SourceNodeSelectionListener(
            this,
            sourceNode,
            `${edgeId}_sourceListener`
        );

        this.targetSelectionListener = new TargetNodeSelectionListener(
            this,
            targetNode,
            `${edgeId}_targetListener`
        );

        // Create wrapper functions that bridge Observer and MementoAwareListener
        this.sourceSelectionWrapper = (args: TVisualObjectPropertyChangeArgs) => this.sourceSelectionListener!.onNotify(args);
        this.targetSelectionWrapper = (args: TVisualObjectPropertyChangeArgs) => this.targetSelectionListener!.onNotify(args);

        // Subscribe using the wrapper functions
        sourceNode.subscribeToPropertyChanges(this.sourceSelectionWrapper);
        targetNode.subscribeToPropertyChanges(this.targetSelectionWrapper);
    }

    /**
     * Cleanup method to unsubscribe listeners when edge is destroyed
     */
    dispose(): void {
        const sourceNode = this.getSource() as PassageNodeVisualObject;
        const targetNode = this.getTarget() as PassageNodeVisualObject;

        if (this.sourceSelectionWrapper && sourceNode) {
            sourceNode.unsubscribeFromPropertyChanges(this.sourceSelectionWrapper);
        }

        if (this.targetSelectionWrapper && targetNode) {
            targetNode.unsubscribeFromPropertyChanges(this.targetSelectionWrapper);
        }
    }
}