// Clase base con captura de stack trace
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    isOperational = true,
    details?: unknown
  ) {
    super(message);

    // Mantiene proper stack trace en V8
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);

    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.name = this.constructor.name;
  }

  toJSON() {
    const result: { code: string; message: string; details?: unknown } = {
      code: this.errorCode,
      message: this.message,
    };

    if (this.details !== undefined) {
      result.details = this.details;
    }

    return { error: result };
  }
}

// Clases específicas con mensajes predeterminados en español
export class BadRequestError extends AppError {
  constructor(message: string = 'Solicitud inválida', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', true, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Error de validación', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Usuario o contraseña incorrectos') {
    super(message, 401, 'UNAUTHORIZED', true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Esa acción no se puede realizar') {
    super(message, 403, 'FORBIDDEN', true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Recurso') {
    super(`${resource} no encontrado`, 404, 'NOT_FOUND', true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT', true);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Error interno del servidor', details?: unknown) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', false, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Error en la base de datos', details?: unknown) {
    super(message, 500, 'DATABASE_ERROR', false, details);
  }
}

// Errores específicos del negocio
export class TicketNotOwnedError extends AppError {
  constructor() {
    super('El ticket no pertenece al usuario', 403, 'TICKET_NOT_OWNED', true);
  }
}

export class TicketAlreadyPaidError extends AppError {
  constructor() {
    super('El ticket ya fue pagado', 400, 'TICKET_ALREADY_PAID', true);
  }
}

export class TicketNotWinnerError extends AppError {
  constructor() {
    super('El ticket no es ganador', 400, 'TICKET_NOT_WINNER', true);
  }
}

export class InvalidDeleteTimeError extends AppError {
  constructor() {
    super('Pasaron más de 2 minutos desde la creación', 400, 'INVALID_DELETE_TIME', true);
  }
}
