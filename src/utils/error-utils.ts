type SlackErrorData = {
  error?: string;
  needed?: string;
};

function getSlackErrorData(error: unknown): SlackErrorData | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  const data = (error as Error & { data?: unknown }).data;
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  return data as SlackErrorData;
}

export function getSlackErrorCode(error: unknown): string | undefined {
  const data = getSlackErrorData(error);
  if (typeof data?.error === 'string' && data.error.length > 0) {
    return data.error;
  }

  if (error instanceof Error && error.message.includes('missing_scope')) {
    return 'missing_scope';
  }

  return undefined;
}

export function getSlackNeededScopes(error: unknown): string[] {
  const data = getSlackErrorData(error);
  if (typeof data?.needed !== 'string' || data.needed.length === 0) {
    return [];
  }

  return data.needed
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const neededScopes = getSlackNeededScopes(error);
    if (getSlackErrorCode(error) === 'missing_scope' && neededScopes.length > 0) {
      return `${error.message} (needed: ${neededScopes.join(', ')})`;
    }

    return error.message;
  }
  return String(error);
}
