
import { EdgeVisualObject, TLineType } from '../EdgeVisualObject';
import { NodeVisualObject } from '../Node/NodeVisualObject';
import { PassageNodeVisualObject, selectableVisualProperties } from './PassageNodeVisualObject';


export class PassageEdgeVisualObject extends EdgeVisualObject {
    _onTargetSelectedColor: string = '#0000ff';
    _onSourceSelectedColor: string = '#ff0000';

    _defaultColor: string = '#000000';

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

        // Subscribe to node isSelected changes
        var sourceNode = this.getSource() as PassageNodeVisualObject;
        (sourceNode as PassageNodeVisualObject).onPropertyChanged.subscribe((args) => {
            if (args.property === selectableVisualProperties.isSelected) {
                if (sourceNode.isSelected) {
                    this.setColor(this._onSourceSelectedColor);
                    this.setZIndex(this.zIndex + 1);
                } else {
                    this.setColor(this._defaultColor);
                    this.setZIndex(this.zIndex - 1);
                }
            }
        });

        var targetNode = this.getTarget() as PassageNodeVisualObject;
        (targetNode as PassageNodeVisualObject).onPropertyChanged.subscribe((args) => {
            if (args.property === selectableVisualProperties.isSelected) {
                if (targetNode.isSelected) {
                    this.setZIndex(this.zIndex + 1);
                    this.setColor(this._onTargetSelectedColor);
                } else {
                    this.setColor(this._defaultColor);
                    this.setZIndex(this.zIndex - 1);
                }
            }

        });
    }
}