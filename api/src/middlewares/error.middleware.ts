import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@helper/errors';
import { APIResponse } from '@helper/response/api_response.response';
import { logger } from '../utils/logger';
import { IS_PRODUCTION } from '../../envs';

/**
 * Centralized error handling middleware
 * DEBE registrarse DESPUÉS de todas las rutas
 * IMPORTANTE: Necesita 4 parámetros (err, req, res, next) para que Express lo reconozca como error handler
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line no-unused-vars
  _next: NextFunction
): void => {
  // Log completo del error para debugging
  logger.error('Error caught by middleware:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Manejar errores de validación Zod
  if (err instanceof ZodError) {
    const response: APIResponse<null> = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Error de validación en los datos enviados',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    };
    res.status(400).json(response);
    return;
  }

  // Manejar errores operacionales (AppError)
  if (err instanceof AppError) {
    const response: APIResponse<null> = {
      error: {
        code: err.errorCode,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Manejar errores de Supabase/PostgreSQL
  const errWithCode = err as unknown as { code?: string };
  if (err.name === 'PostgrestError' || errWithCode.code?.startsWith('PGRST')) {
    logger.error('Database error:', err);
    const response: APIResponse<null> = {
      error: {
        code: 'DATABASE_ERROR',
        message: IS_PRODUCTION ? 'Error en la base de datos' : err.message,
        ...(!IS_PRODUCTION && { details: err }),
      },
    };
    res.status(500).json(response);
    return;
  }

  // Error inesperado (programming error)
  logger.error('Unexpected error:', err);
  const response: APIResponse<null> = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: IS_PRODUCTION ? 'Ocurrió un error inesperado' : err.message,
      ...(!IS_PRODUCTION && { details: { stack: err.stack } }),
    },
  };
  res.status(500).json(response);
};

/**
 * Async error wrapper - elimina necesidad de try/catch
 * Uso: private handler = asyncHandler(async (req, res) => { ... })
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
