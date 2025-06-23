export interface BaseFormatter<T> {
  format(data: T): void;
}

export abstract class AbstractFormatter<T> implements BaseFormatter<T> {
  abstract format(data: T): void;
}

export abstract class JsonFormatter<TInput, TOutput = any> extends AbstractFormatter<TInput> {
  protected abstract transform(data: TInput): TOutput;

  format(data: TInput): void {
    console.log(JSON.stringify(this.transform(data), null, 2));
  }
}

export interface FormatterMap<T> {
  table: BaseFormatter<T>;
  simple: BaseFormatter<T>;
  json: BaseFormatter<T>;
  [key: string]: BaseFormatter<T>;
}

export class FormatterFactory<T> {
  constructor(private formatters: FormatterMap<T>) {}

  create(format: string = 'table'): BaseFormatter<T> {
    return this.formatters[format] || this.formatters.table;
  }
}

export function createFormatterFactory<T>(formatters: FormatterMap<T>): FormatterFactory<T> {
  return new FormatterFactory(formatters);
}
