export interface TimeoutError extends Error {
  isTimeout: true;
  originalPromise: Promise<any>;
}

export function createTimeoutError(message: string, originalPromise: Promise<any>): TimeoutError {
  const error = new Error(message) as TimeoutError;
  error.isTimeout = true;
  error.originalPromise = originalPromise;
  return error;
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        const message = timeoutMessage || `Operation timed out after ${timeoutMs}ms`;
        reject(createTimeoutError(message, promise));
      }, timeoutMs);
    }),
  ]);
}

export function isTimeoutError(error: any): error is TimeoutError {
  return error && error.isTimeout === true;
}
