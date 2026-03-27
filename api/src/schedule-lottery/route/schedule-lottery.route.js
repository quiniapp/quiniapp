import { Router } from 'express';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { ScheduleLotteryController } from '../controller/schedule-lottery.controller';
import { SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';
import { globalCacheManager } from 'src/cache/CacheManager';
import { getScheduleLotteryCacheKey, invalidateScheduleLotteryRelated, } from 'src/cache/cacheInvalidation';
// ====== Cache Manager para Schedule Lotteries ======
const TTL_MS = 24 * 60 * 60 * 1000; // 1 dia
function getCacheKey(organization_id) {
    return getScheduleLotteryCacheKey(organization_id);
}
export class ScheduleLotteryRouter {
    constructor() {
        // ====== POST: guarda e invalida cache ======
        this.newScheduleLotteryHandler = async (req, res) => {
            const { user } = req;
            const { scheduleLottery } = req.body;
            if (user?.user.user_type === USER_TYPE.CASHIER) {
                const response = {
                    error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
                };
                res.status(403).json(response);
                return;
            }
            // Validate request payload
            if (!scheduleLottery || typeof scheduleLottery !== 'object') {
                const response = {
                    error: {
                        error: ERROR_TYPE.BAD_REQUEST,
                        message: 'scheduleLottery is required and must be an object',
                    },
                };
                res.status(400).json(response);
                return;
            }
            // UUID regex pattern
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            // Validate day keys, schedule_ids, and lottery_ids
            for (const dayKey of Object.keys(scheduleLottery)) {
                // Validate day key is a valid SCHEDULE_DAY enum value
                if (!(dayKey in SCHEDULE_DAY)) {
                    const response = {
                        error: {
                            error: ERROR_TYPE.BAD_REQUEST,
                            message: `Invalid day key: ${dayKey}. Must be one of: SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY`,
                        },
                    };
                    res.status(400).json(response);
                    return;
                }
                const schedules = scheduleLottery[dayKey];
                if (!schedules || typeof schedules !== 'object')
                    continue;
                for (const scheduleId of Object.keys(schedules)) {
                    // Validate schedule_id is a valid UUID
                    if (!uuidPattern.test(scheduleId)) {
                        const response = {
                            error: {
                                error: ERROR_TYPE.BAD_REQUEST,
                                message: `Invalid schedule_id format: ${scheduleId}. Must be a valid UUID`,
                            },
                        };
                        res.status(400).json(response);
                        return;
                    }
                    const lotteries = schedules[scheduleId];
                    if (!Array.isArray(lotteries)) {
                        const response = {
                            error: {
                                error: ERROR_TYPE.BAD_REQUEST,
                                message: `Lotteries for schedule ${scheduleId} must be an array`,
                            },
                        };
                        res.status(400).json(response);
                        return;
                    }
                    // Validate each lottery_id is a valid UUID
                    for (const lotteryId of lotteries) {
                        if (!uuidPattern.test(lotteryId)) {
                            const response = {
                                error: {
                                    error: ERROR_TYPE.BAD_REQUEST,
                                    message: `Invalid lottery_id format: ${lotteryId}. Must be a valid UUID`,
                                },
                            };
                            res.status(400).json(response);
                            return;
                        }
                    }
                }
            }
            try {
                // Use controller's saveScheduleLottery method for atomic save
                const data = await this.controller.saveScheduleLottery(scheduleLottery, req.organization_id);
                // Invalidate cache after successful save
                invalidateScheduleLotteryRelated(req.organization_id);
                const response = {
                    data: { scheduleLotteries: data },
                };
                res.status(200).json(response);
            }
            catch (error) {
                console.error(error);
                if (error instanceof Error) {
                    let statusCode = 500;
                    if (error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
                        error.message === ERROR_MESSAGE.INVALID_CREDENTIALS) {
                        statusCode = 401;
                    }
                    const response = {
                        error: { error: ERROR_TYPE.AUTH_ERROR, message: error.message },
                    };
                    res.status(statusCode).json(response);
                }
            }
        };
        // ====== GET: sirve desde cache + ETag/304 ======
        this.getScheduleLotteryHandler = async (req, res) => {
            try {
                const snap = await globalCacheManager.getOrLoad(getCacheKey(req.organization_id), () => this.controller.getAllScheduleLotteries(req.organization_id), { ttl: TTL_MS, etagStrategy: 'hash' });
                // Soporta If-None-Match para 304 (ahorra ancho de banda y CPU)
                const inm = req.headers['if-none-match'];
                if (inm && inm === snap.etag) {
                    res.status(304).end();
                    return;
                }
                const response = {
                    data: { scheduleLotteries: snap.payload },
                };
                // Cache-Control/ETag para clientes/proxies (CDN opcional)
                res.setHeader('ETag', snap.etag);
                // max-age para clientes; stale-while-revalidate para proxies/CDN modernos
                res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
                res.status(200).json(response);
            }
            catch (error) {
                console.error(error);
                if (error instanceof Error) {
                    let statusCode = 500;
                    if (error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
                        error.message === ERROR_MESSAGE.INVALID_CREDENTIALS) {
                        statusCode = 401;
                    }
                    const response = {
                        error: { error: ERROR_TYPE.AUTH_ERROR, message: error.message },
                    };
                    res.status(statusCode).json(response);
                }
            }
        };
        this.router = Router();
        this.controller = new ScheduleLotteryController();
        this.setupRoutes();
    }
    setupRoutes() {
        this.router.post('/', this.newScheduleLotteryHandler);
        this.router.get('/', this.getScheduleLotteryHandler);
    }
}
