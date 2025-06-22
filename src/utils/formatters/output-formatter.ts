export interface OutputFormatter<T> {
  format(data: T[]): void;
}

export abstract class BaseFormatter<T> implements OutputFormatter<T> {
  abstract format(data: T[]): void;
}
