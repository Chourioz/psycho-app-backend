export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public status: string = 'error',
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  static BadRequest(message: string) {
    return new AppError(400, message);
  }

  static Unauthorized(message: string) {
    return new AppError(401, message);
  }

  static Forbidden(message: string) {
    return new AppError(403, message);
  }

  static NotFound(message: string) {
    return new AppError(404, message);
  }

  static ValidationError(message: string) {
    return new AppError(422, message);
  }

  static Conflict(message: string) {
    return new AppError(409, message);
  }

  static InternalError(message: string) {
    return new AppError(500, message);
  }
} 