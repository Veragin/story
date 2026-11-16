export interface IEditorSource {
    readonly dirty: boolean;
    readonly saving: boolean;
    readonly stale: unknown;
    discard(): void;
    save(): Promise<boolean>;
}
