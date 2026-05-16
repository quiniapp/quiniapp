import winston from 'winston';
import { IS_PRODUCTION } from '../../envs';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: IS_PRODUCTION ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'quiniapp-api' },
  transports: [
    // Consola siempre activa — en Vercel el filesystem es efímero y no persiste
    new winston.transports.Console({
      format: IS_PRODUCTION
        ? logFormat
        : winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    // Archivos solo en desarrollo (en producción/serverless no tienen utilidad)
    ...(!IS_PRODUCTION
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880,
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});
