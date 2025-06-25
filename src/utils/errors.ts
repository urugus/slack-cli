export class SlackCliError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ConfigurationError extends SlackCliError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
  }
}

export class ValidationError extends SlackCliError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class ApiError extends SlackCliError {
  constructor(message: string) {
    super(message, 'API_ERROR');
  }
}

export class FileError extends SlackCliError {
  constructor(message: string) {
    super(message, 'FILE_ERROR');
  }
}
