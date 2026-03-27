import { Router } from 'express';
import { LotteryController } from '../controller/lottery.controller';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { updateLotterySchema } from '@helper/schemas/lottery.schema';
import { globalCacheManager } from 'src/cache/CacheManager';
import { getLotteryCacheKey, invalidateLotteryRelated } from 'src/cache/cacheInvalidation';
import { SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';
// ====== Cache Manager para Lotteries ======
function keyFor(organization_id, allFlag) {
    return getLotteryCacheKey(organization_id, allFlag);
}
export class LotteryRouter {
    constructor() {
        this.newLotteryHandler = async (req, res) => {
            const { name } = req.body;
            const user = req.user;
            if (!name || typeof name !== 'string') {
                const response = {
                    error: { error: ERROR_TYPE.NAME_IS_REQUIRED, message: ERROR_MESSAGE.NAME_IS_REQUIRED },
                };
                res.status(400).json(response);
                return;
            }
            if (user?.user.user_type === USER_TYPE.CASHIER) {
                const response = {
                    error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
                };
                res.status(403).json(response);
                return;
            }
            try {
                const lottery = await this.controller.create({ name }, req.organization_id);
                // invalidación (ambas variantes all=true/false)
                invalidateLotteryRelated(req.organization_id);
                const response = { data: { lottery } };
                res.status(200).json(response);
            }
            catch (error) {
                console.error(error);
                if (error instanceof Error) {
                    let statusCode = 500;
                    if (error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
                        error.message === ERROR_MESSAGE.INVALID_CREDENTIALS)
                        statusCode = 401;
                    const response = {
                        error: { error: ERROR_TYPE.AUTH_ERROR, message: error.message },
                    };
                    res.status(statusCode).json(response);
                }
            }
        };
        this.getAllLotteryHandler = async (req, res) => {
            const { user } = req;
            const allFlag = !!req.query.all;
            const dayParam = req.query.day;
            if (!user?.user) {
                const response = {
                    error: { error: ERROR_TYPE.BAD_REQUEST, message: ERROR_MESSAGE.BAD_REQUEST },
                };
                res.status(500).json(response);
                return;
            }
            // Validate day parameter if provided
            let day;
            if (dayParam) {
                if (!(dayParam in SCHEDULE_DAY)) {
                    const response = {
                        error: {
                            error: ERROR_TYPE.BAD_REQUEST,
                            message: `Invalid day parameter: ${dayParam}. Must be one of: SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY`,
                        },
                    };
                    res.status(400).json(response);
                    return;
                }
                day = SCHEDULE_DAY[dayParam];
            }
            try {
                // If day filter is provided, fetch filtered lotteries
                // Note: day-filtered queries are not cached as they're typically used in high-frequency contexts
                if (day !== undefined) {
                    const lotteries = await this.controller.getAllByDay(day, allFlag, req.organization_id);
                    const response = {
                        data: { lottery: lotteries },
                    };
                    // Cache-Control for day-filtered queries
                    res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
                    res.status(200).json(response);
                    return;
                }
                // Original caching logic for non-filtered queries
                const key = keyFor(req.organization_id, allFlag);
                const snap = await globalCacheManager.getOrLoad(key, () => this.controller.getAll(allFlag, req.organization_id), {
                    etagStrategy: 'timestamp',
                });
                // 304 si el cliente tiene la misma versión
                const inm = req.headers['if-none-match'];
                if (inm && inm === snap.etag) {
                    res.status(304).end();
                    return;
                }
                const response = {
                    data: { lottery: snap.payload },
                };
                // "sin TTL": forzá revalidación de cliente/proxy via ETag
                // (el ETag sólo cambia en mutaciones)
                res.setHeader('ETag', snap.etag);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                res.status(200).json(response);
            }
            catch (error) {
                console.error(error);
                if (error instanceof Error) {
                    let statusCode = 500;
                    if (error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
                        error.message === ERROR_MESSAGE.INVALID_CREDENTIALS)
                        statusCode = 401;
                    const response = {
                        error: { error: ERROR_TYPE.AUTH_ERROR, message: error.message },
                    };
                    res.status(statusCode).json(response);
                }
            }
        };
        this.updateLotteryHandler = async (req, res) => {
            const { user } = req;
            const { id: lottery_id } = req.params;
            const { updateLottery } = req.body;
            if (user?.user.user_type === USER_TYPE.CASHIER) {
                const response = {
                    error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
                };
                res.status(403).json(response);
                return;
            }
            const result = updateLotterySchema.safeParse(updateLottery);
            if (!result.success) {
                const response = {
                    error: { error: ERROR_TYPE.BAD_REQUEST, message: String(result.error.message) },
                };
                res.status(400).json(response);
                return;
            }
            try {
                const lottery = await this.controller.update(lottery_id, updateLottery, req.organization_id);
                invalidateLotteryRelated(req.organization_id);
                const response = { data: { lottery } };
                res.status(200).json(response);
            }
            catch (error) {
                console.error(error);
                if (error instanceof Error) {
                    let statusCode = 500;
                    if (error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
                        error.message === ERROR_MESSAGE.INVALID_CREDENTIALS)
                        statusCode = 401;
                    const response = {
                        error: { error: ERROR_TYPE.AUTH_ERROR, message: error.message },
                    };
                    res.status(statusCode).json(response);
                }
            }
        };
        this.deleteLotteryHandler = async (req, res) => {
            const { user } = req;
            const { id: lottery_id } = req.params;
            if (user?.user.user_type === USER_TYPE.CASHIER) {
                const response = {
                    error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
                };
                res.status(403).json(response);
                return;
            }
            try {
                await this.controller.delete({ lottery_id }, req.organization_id);
                invalidateLotteryRelated(req.organization_id);
                res.status(200).json({ data: { deleted: true } });
            }
            catch (error) {
                console.error(error);
                if (error instanceof Error) {
                    let statusCode = 500;
                    if (error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
                        error.message === ERROR_MESSAGE.INVALID_CREDENTIALS)
                        statusCode = 401;
                    const response = {
                        error: { error: ERROR_TYPE.AUTH_ERROR, message: error.message },
                    };
                    res.status(statusCode).json(response);
                }
            }
        };
        this.router = Router();
        this.controller = new LotteryController();
        this.setupRoutes();
    }
    setupRoutes() {
        // this.router.get('/:id', this.controller.get);
        this.router.get('/', this.getAllLotteryHandler);
        this.router.post('/', this.newLotteryHandler);
        this.router.put('/:id', this.updateLotteryHandler);
        this.router.delete('/:id', this.deleteLotteryHandler);
    }
}
