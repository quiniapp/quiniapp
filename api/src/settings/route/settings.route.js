import { Router } from 'express';
import { SettingsController } from '../controller/settings.controller';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
export class SettingsLotteryRouter {
    constructor() {
        this.getStorageSettingsHandler = async (req, res) => {
            const { user } = req;
            if (!user?.user) {
                const response = {
                    error: {
                        error: ERROR_TYPE.BAD_REQUEST,
                        message: ERROR_MESSAGE.BAD_REQUEST,
                    },
                };
                res.status(500).json(response);
                return;
            }
            if (user?.user.user_type === USER_TYPE.CASHIER) {
                const response = {
                    error: {
                        error: ERROR_TYPE.FORBIDDEN,
                        message: ERROR_MESSAGE.FORBIDDEN,
                    },
                };
                res.status(500).json(response);
                return;
            }
            try {
                const settings = await this.controller.getStorageStatus();
                const response = {
                    data: {
                        storage: settings,
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
        this.controller = new SettingsController();
        this.setupRoutes();
    }
    setupRoutes() {
        this.router.get('/storage', this.getStorageSettingsHandler);
    }
}
