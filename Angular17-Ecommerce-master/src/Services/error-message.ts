/** Picks the server's human-readable message when there is one, so shoppers see "Only 2 left in stock." */
export function messageFrom(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const body = (error as { error?: { message?: unknown } } | null)?.error;
  if (body && typeof body.message === 'string' && body.message.length > 0) {
    return body.message;
  }
  if (error instanceof Error && error.message && !error.message.startsWith('Http failure')) {
    return error.message;
  }
  return fallback;
}
