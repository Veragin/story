export interface NodeBorderConfig {
    color: string;
    width: number;
    style: 'solid' | 'dashed';
    radius: number;
}

export interface NodeTextConfig {
    font: string;
    color: string;
    alignment: 'middle_center' | 'top_left' | 'top_center';
}

export interface NodeDimensions {
    width: number;
    height: number;
}
