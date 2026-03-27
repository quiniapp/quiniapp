import winston from 'winston';
import { IS_PRODUCTION } from '../../envs';
const logFormat = winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.errors({ stack: true }), winston.format.splat(), winston.format.json());
export const logger = winston.createLogger({
    level: IS_PRODUCTION ? 'info' : 'debug',
    format: logFormat,
    defaultMeta: { service: 'quiniapp-api' },
    transports: [
        // Errores en archivo separado
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Todos los logs
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880,
            maxFiles: 5,
        }),
    ],
});
// En desarrollo, también log a consola con formato legible
if (!IS_PRODUCTION) {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }));
}
