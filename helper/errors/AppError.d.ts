export declare class AppError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly isOperational: boolean;
  readonly details?: unknown;
  readonly timestamp: string;
  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    isOperational?: boolean,
    details?: unknown
  );
  toJSON(): {
    error: {
      code: string;
      message: string;
      details?: unknown;
    };
  };
}
export declare class BadRequestError extends AppError {
  constructor(message?: string, details?: unknown);
}
export declare class ValidationError extends AppError {
  constructor(message?: string, details?: unknown);
}
export declare class UnauthorizedError extends AppError {
  constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
  constructor(message?: string);
}
export declare class NotFoundError extends AppError {
  constructor(resource?: string);
}
export declare class ConflictError extends AppError {
  constructor(message: string);
}
export declare class InternalServerError extends AppError {
  constructor(message?: string, details?: unknown);
}
export declare class DatabaseError extends AppError {
  constructor(message?: string, details?: unknown);
}
export declare class TicketNotOwnedError extends AppError {
  constructor();
}
export declare class TicketAlreadyPaidError extends AppError {
  constructor();
}
export declare class TicketNotWinnerError extends AppError {
  constructor();
}
export declare class InvalidDeleteTimeError extends AppError {
  constructor();
}
