export class SlackCliError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'SlackCliError';
  }
}

export class ConfigurationError extends SlackCliError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}

export class ValidationError extends SlackCliError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class ApiError extends SlackCliError {
  constructor(message: string) {
    super(message, 'API_ERROR');
    this.name = 'ApiError';
  }
}

export class FileError extends SlackCliError {
  constructor(message: string) {
    super(message, 'FILE_ERROR');
    this.name = 'FileError';
  }
}
