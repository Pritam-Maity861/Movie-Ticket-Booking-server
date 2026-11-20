export class ApiError extends Error {
  statusCode: number;
  data: any;
  success: boolean;
  errors: any[];
  errorCode: string;

  constructor(
    statusCode: number,
    message: string = "SOMETHING WENT WRONG",
    errors: any[] = [],
    errorCode?: string,
    stack: string = "",
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.success = false;
    this.errors = errors;
    this.errorCode =
      errorCode ||
      (statusCode === 400
        ? "BAD_REQUEST"
        : statusCode === 401
          ? "UNAUTHORIZED"
          : statusCode === 403
            ? "FORBIDDEN"
            : statusCode === 404
              ? "NOT_FOUND"
              : statusCode === 409
                ? "CONFLICT"
                : "INTERNAL_ERROR");

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
  