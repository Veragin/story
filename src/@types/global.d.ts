declare interface Window {
    e: import('code/Engine/ts/Engine').Engine;
    s: import('data/TWorldState').TWorldState;
}

declare type TPoint = {
    x: number;
    y: number;
};

declare type TSize = {
    width: number;
    height: number;
};

declare let _: (str: string, ...values: (string | number)[]) => string;

declare type TVec = {
    x: number;
    y: number;
};