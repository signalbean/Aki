// src/shared/error.ts

/**
 * Custom error for handling server-side errors (5xx) from the API.
 */
export class ApiServerError extends Error {
  public readonly status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiServerError';
    this.status = status;
    Object.setPrototypeOf(this, ApiServerError.prototype);
  }
}
