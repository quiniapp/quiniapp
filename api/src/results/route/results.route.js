import { Router } from 'express';
import { ResultsController } from '../controller/results.controller';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { editResultsSchema, getResultsSchema, newResultsSchema, } from '@helper/schemas/results.schema';
export class ResultsRouter {
    constructor() {
        this.newResultshandler = async (req, res) => {
            const { user } = req;
            const { newResults } = req.body;
            if (user?.user.user_type === USER_TYPE.CASHIER) {
                const response = {
                    error: {
                        error: ERROR_TYPE.FORBIDDEN,
                        message: ERROR_MESSAGE.FORBIDDEN,
                    },
                };
                res.status(403).json(response);
                return;
            }
            const result = newResultsSchema.safeParse(newResults);
            if (!result.success) {
                const response = {
                    error: {
                        error: ERROR_TYPE.BAD_REQUEST,
                        message: String(result.error.message),
                    },
                };
                res.status(400).json(response); // <-- SIN return
                return;
            }
            try {
                const results = await this.controller.create(newResults, req.organization_id);
                const response = {
                    data: {
                        results,
                    },
                };
                res.status(200).json(response);
                return;
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
                        error: {
                            error: ERROR_TYPE.AUTH_ERROR,
                            message: error.message,
                        },
                    };
                    res.status(statusCode).json(response);
                    return;
                }
            }
        };
        this.getResultsHandler = async (req, res) => {
            const { user } = req;
            if (!user || !user?.user) {
                const response = {
                    error: {
                        error: ERROR_TYPE.BAD_REQUEST,
                        message: ERROR_MESSAGE.BAD_REQUEST,
                    },
                };
                res.status(403).json(response);
                return;
            }
            try {
                if (Object.keys(req.query).length === 0) {
                    const results = await this.controller.getAll(req.organization_id);
                    const response = {
                        data: {
                            results,
                        },
                    };
                    res.status(200).json(response);
                    return;
                }
                const parsed = getResultsSchema.safeParse(req.query);
                if (!parsed.success) {
                    const response = {
                        error: {
                            error: ERROR_TYPE.BAD_REQUEST,
                            message: String(parsed.error.message),
                        },
                    };
                    res.status(400).json(response); // <-- SIN return
                    return;
                }
                const { results_id, date, lottery_id, schedule_id } = parsed.data;
                const results = await this.controller.get({
                    results_id,
                    date,
                    lottery_id,
                    schedule_id,
                }, req.organization_id);
                const response = {
                    data: {
                        results,
                    },
                };
                res.status(200).json(response);
                return;
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
                        error: {
                            error: ERROR_TYPE.AUTH_ERROR,
                            message: error.message,
                        },
                    };
                    res.status(statusCode).json(response);
                    return;
                }
            }
        };
        this.updateResultsHandler = async (req, res) => {
            const { user } = req;
            const { id: results_id } = req.params;
            const { updateResults } = req.body;
            if (user?.user.user_type === USER_TYPE.CASHIER) {
                const response = {
                    error: {
                        error: ERROR_TYPE.FORBIDDEN,
                        message: ERROR_MESSAGE.FORBIDDEN,
                    },
                };
                res.status(403).json(response);
                return;
            }
            const result = editResultsSchema.safeParse(updateResults);
            if (!result.success) {
                const response = {
                    error: {
                        error: ERROR_TYPE.BAD_REQUEST,
                        message: String(result.error.message),
                    },
                };
                res.status(400).json(response); // <-- SIN return
                return;
            }
            try {
                const results = await this.controller.update(results_id, updateResults, req.organization_id);
                const response = {
                    data: {
                        results,
                    },
                };
                res.status(200).json(response);
                return;
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
                        error: {
                            error: ERROR_TYPE.AUTH_ERROR,
                            message: error.message,
                        },
                    };
                    res.status(statusCode).json(response);
                    return;
                }
            }
        };
        this.deleteResultsHandler = async (req, res) => {
            const { user } = req;
            const { id: results_id } = req.params;
            if (user?.user.user_type === USER_TYPE.CASHIER) {
                const response = {
                    error: {
                        error: ERROR_TYPE.FORBIDDEN,
                        message: ERROR_MESSAGE.FORBIDDEN,
                    },
                };
                res.status(403).json(response);
                return;
            }
            try {
                const results = await this.controller.delete(results_id, req.organization_id);
                const response = {
                    data: {
                        results,
                    },
                };
                res.status(200).json(response);
                return;
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
                        error: {
                            error: ERROR_TYPE.AUTH_ERROR,
                            message: error.message,
                        },
                    };
                    res.status(statusCode).json(response);
                    return;
                }
            }
        };
        this.router = Router();
        this.controller = new ResultsController();
        this.setupRoutes();
    }
    setupRoutes() {
        this.router.get('/', this.getResultsHandler);
        this.router.post('/', this.newResultshandler);
        this.router.put('/:id', this.updateResultsHandler);
        this.router.delete('/:id', this.deleteResultsHandler);
    }
}
