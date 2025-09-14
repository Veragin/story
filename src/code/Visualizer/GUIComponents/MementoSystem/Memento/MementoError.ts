export class MementoError extends Error {
  constructor(
    message: string,
    public readonly context?: string,
    public readonly propertyPath?: string
  ) {
    super(message);
    this.name = 'MementoError';
  }
}