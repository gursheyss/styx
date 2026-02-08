export class HealthApiError extends Error {
  readonly statusCode: number | null;

  constructor(message: string, statusCode: number | null) {
    super(message);
    this.name = "HealthApiError";
    this.statusCode = statusCode;
  }
}
