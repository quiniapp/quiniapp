import { Router } from 'express';
import { BetController } from '../controller/bet.controller';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { UserRepository } from '../../user/repository/user.repository';
export class BetRouter {
    constructor() {
        /**
         * Resolve the array of organization IDs to query.
         * CASHIER always sees only their own org.
         * All other roles see their org + all sub-orgs (full network).
         */
        this.getOrgIds = async (req) => {
            const rootOrgId = req.organization_id;
            const userType = req.user?.user.user_type;
            if (userType === USER_TYPE.CASHIER) {
                return [rootOrgId];
            }
            return this.userRepository.getOrganizationDescendants(rootOrgId);
        };
        this.getAllBets = async (req, res) => {
            const { date, schedule_id, cashier_id, lottery_id, winners, grouped, tern, quatern, ticket_number, page, limit, } = req.query;
            const { user } = req;
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
                const organization_ids = await this.getOrgIds(req);
                const result = await this.controller.getAllBets({
                    date,
                    schedule_id: typeof schedule_id === 'string' ? schedule_id : undefined,
                    cashier_id: user?.user.user_type === USER_TYPE.CASHIER
                        ? user.user.user_id
                        : typeof cashier_id === 'string'
                            ? cashier_id
                            : undefined,
                    lottery_id: typeof lottery_id === 'string' ? lottery_id : undefined,
                    winners: winners === 'true' ? true : false,
                    grouped: grouped === 'true' ? true : false,
                    tern: tern === 'true' ? true : false,
                    quatern: quatern === 'true' ? true : false,
                    ticket_number: typeof ticket_number === 'string' ? ticket_number : undefined,
                    page: typeof page === 'string' ? parseInt(page, 10) : 1,
                    limit: typeof limit === 'string' ? Math.max(1, parseInt(limit, 10) || 100) : 100,
                    organization_ids,
                });
                const response = {
                    data: {
                        bets: result,
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
        this.getTotalAmount = async (req, res) => {
            const { date, schedule_id, cashier_id, lottery_id } = req.query;
            const { user } = req;
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
                const organization_ids = await this.getOrgIds(req);
                const total = await this.controller.getTotalAmount({
                    date,
                    schedule_id: typeof schedule_id === 'string' ? schedule_id : undefined,
                    cashier_id: user?.user.user_type === USER_TYPE.CASHIER
                        ? user.user.user_id
                        : typeof cashier_id === 'string'
                            ? cashier_id
                            : undefined,
                    lottery_id: typeof lottery_id === 'string' ? lottery_id : undefined,
                    organization_ids,
                });
                const response = {
                    data: {
                        total,
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
        this.getTotalPrize = async (req, res) => {
            const { date, schedule_id, cashier_id, lottery_id } = req.query;
            const { user } = req;
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
                const organization_ids = await this.getOrgIds(req);
                const total = await this.controller.getTotalPrize({
                    date,
                    schedule_id: typeof schedule_id === 'string' ? schedule_id : undefined,
                    cashier_id: user?.user.user_type === USER_TYPE.CASHIER
                        ? user.user.user_id
                        : typeof cashier_id === 'string'
                            ? cashier_id
                            : undefined,
                    lottery_id: typeof lottery_id === 'string' ? lottery_id : undefined,
                    organization_ids,
                });
                const response = {
                    data: {
                        total,
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
        this.getAmountsByTicket = async (req, res) => {
            const { ticket_number } = req.query;
            if (typeof ticket_number !== 'string') {
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
                const organization_ids = await this.getOrgIds(req);
                const total = await this.controller.getAmountsByTicket({
                    ticket_number,
                    organization_ids,
                });
                const response = {
                    data: {
                        total,
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
        this.controller = new BetController();
        this.userRepository = new UserRepository();
        this.setupRoutes();
    }
    setupRoutes() {
        // this.router.get('/:id', this.controller.get);
        this.router.get('/', this.getAllBets);
        this.router.get('/group', this.getAllBets);
        this.router.get('/total', this.getTotalAmount);
        this.router.get('/prize', this.getTotalPrize);
        this.router.get('/amounts', this.getAmountsByTicket);
        // this.router.post('/', this.controller.create);
        // this.router.put('/:id', this.controller.update);
        // this.router.delete('/:id', this.controller.delete);
    }
}
