import { Router } from 'express';
import { ScheduleController } from '../controller/schedule.controller';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { newScheduleSchema, updateScheduleSchema } from '@helper/schemas/schedule.schema';
import { globalCacheManager } from 'src/cache/CacheManager';
import { getScheduleCacheKey, invalidateScheduleRelated } from 'src/cache/cacheInvalidation';
import { SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';
// ====== Cache Manager para Schedules ======
function getCacheKey(organization_id, all) {
    return getScheduleCacheKey(organization_id, all);
}
export class ScheduleRouter {
    constructor() {
        this.newSchedulehandler = async (req, res) => {
            const { user, organization_id } = req;
            const { newSchedule } = req.body;
            if (user?.user.user_type === USER_TYPE.CASHIER) {
                const response = {
                    error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
                };
                res.status(403).json(response);
                return;
            }
            if (!organization_id) {
                const response = {
                    error: { error: ERROR_TYPE.BAD_REQUEST, message: ERROR_MESSAGE.BAD_REQUEST },
                };
                res.status(403).json(response);
                return;
            }
            const result = newScheduleSchema.safeParse(newSchedule);
            if (!result.success) {
                const response = {
                    error: { error: ERROR_TYPE.BAD_REQUEST, message: String(result.error.message) },
                };
                res.status(400).json(response);
                return;
            }
            try {
                const schedule = await this.controller.create(newSchedule, req.organization_id);
                invalidateScheduleRelated(req.organization_id);
                const response = { data: { schedule } };
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
        this.getAllScheduleHandler = async (req, res) => {
            const { user } = req;
            const allFlag = !!req.query.all;
            const dayParam = req.query.day;
            const withLotteries = req.query.with_lotteries === 'true';
            if (!user?.user) {
                const response = {
                    error: { error: ERROR_TYPE.BAD_REQUEST, message: ERROR_MESSAGE.BAD_REQUEST },
                };
                res.status(403).json(response);
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
                // If day filter is provided, fetch filtered schedules
                // Note: day-filtered queries are not cached as they're typically used in high-frequency contexts
                if (day !== undefined) {
                    const schedules = await this.controller.getAllByDay(day, allFlag, req.organization_id, withLotteries);
                    const response = {
                        data: { schedule: schedules },
                    };
                    // Cache-Control for day-filtered queries
                    res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
                    res.status(200).json(response);
                    return;
                }
                // Original caching logic for non-filtered queries
                const key = getCacheKey(req.organization_id, allFlag);
                const snap = await globalCacheManager.getOrLoad(key, () => this.controller.getAll(req.organization_id, allFlag), {
                    etagStrategy: 'counter',
                });
                // ETag/304: si el cliente tiene la versión actual, no enviamos payload
                const inm = req.headers['if-none-match'];
                if (inm && inm === snap.etag) {
                    res.status(304).end();
                    return;
                }
                const response = { data: { schedule: snap.payload } };
                res.setHeader('ETag', snap.etag);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate'); // sin TTL
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
        this.updateScheduleHandler = async (req, res) => {
            const { user } = req;
            const { id: schedule_id } = req.params;
            const { updateSchedule } = req.body;
            if (user?.user.user_type === USER_TYPE.CASHIER) {
                const response = {
                    error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
                };
                res.status(403).json(response);
                return;
            }
            const result = updateScheduleSchema.safeParse(updateSchedule);
            if (!result.success) {
                const response = {
                    error: { error: ERROR_TYPE.BAD_REQUEST, message: String(result.error.message) },
                };
                res.status(400).json(response);
                return;
            }
            try {
                const schedule = await this.controller.update(schedule_id, updateSchedule, req.organization_id);
                invalidateScheduleRelated(req.organization_id);
                const response = { data: { schedule } };
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
        this.deleteScheduleHandler = async (req, res) => {
            const { user } = req;
            const { id: schedule_id } = req.params;
            if (user?.user.user_type === USER_TYPE.CASHIER) {
                const response = {
                    error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
                };
                res.status(403).json(response);
                return;
            }
            try {
                await this.controller.delete({ schedule_id }, req.organization_id);
                invalidateScheduleRelated(req.organization_id);
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
        this.controller = new ScheduleController();
        this.setupRoutes();
    }
    setupRoutes() {
        // this.router.get('/:id', this.getScheduleHandler);
        this.router.get('/', this.getAllScheduleHandler);
        this.router.post('/', this.newSchedulehandler);
        this.router.put('/:id', this.updateScheduleHandler);
        this.router.delete('/:id', this.deleteScheduleHandler);
    }
}
