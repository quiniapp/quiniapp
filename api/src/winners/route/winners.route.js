import { Router } from 'express';
import { WinnerController } from '../controller/winners.controller';
import { USER_TYPE } from '@helper/types/user.type';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
export class WinnerRouter {
    constructor() {
        this.generateWinnersHandler = async (req, res) => {
            const { user, organization_id } = req;
            const { id: schedule_id } = req.params;
            const { date } = req.query;
            if (!user?.user || user.user.user_type === USER_TYPE.CASHIER || !organization_id) {
                const response = {
                    error: {
                        error: ERROR_TYPE.BAD_REQUEST,
                        message: ERROR_MESSAGE.BAD_REQUEST,
                    },
                };
                res.status(500).json(response);
                return;
            }
            if (typeof date !== 'string') {
                const response = {
                    error: {
                        error: ERROR_TYPE.BAD_REQUEST,
                        message: ERROR_MESSAGE.BAD_REQUEST,
                    },
                };
                res.status(500).json(response);
                return;
            }
            try {
                await this.controller.generateWinners({ schedule_id, date, organization_id });
                const response = {
                    data: {
                        winner: true,
                    },
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
        this.getAllWinnersHandler = async (req, res) => {
            const { user, organization_id } = req;
            const { date } = req.query;
            if (!user?.user || !organization_id) {
                const response = {
                    error: {
                        error: ERROR_TYPE.BAD_REQUEST,
                        message: ERROR_MESSAGE.BAD_REQUEST,
                    },
                };
                res.status(500).json(response);
                return;
            }
            if (typeof date !== 'string') {
                const response = {
                    error: {
                        error: ERROR_TYPE.BAD_REQUEST,
                        message: ERROR_MESSAGE.BAD_REQUEST,
                    },
                };
                res.status(500).json(response);
                return;
            }
            try {
                const winners = await this.controller.getAllWinners({
                    user_type: user.user.user_type,
                    user_id: user.user.user_id,
                    date: date,
                    organization_id: organization_id,
                });
                const response = {
                    data: {
                        winners,
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
        this.controller = new WinnerController();
        this.setupRoutes();
    }
    setupRoutes() {
        this.router.get('/', this.getAllWinnersHandler);
        this.router.post('/:id', this.generateWinnersHandler);
    }
}
