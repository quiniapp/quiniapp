import { Router } from 'express';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { CurrentAccountController } from '../controller/current-account.controller';
import { USER_TYPE } from '@helper/types/user.type';
// import { updateCurrentAccountSchema } from '@helper/schemas/current_account.schema';
// Helper opcional para parsear booleanos
const toBool = (v) => {
    if (typeof v !== 'string')
        return false;
    const s = v.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
};
export class CurrentAccountRouter {
    constructor() {
        this.getAllCurrentAccountHandler = async (req, res) => {
            const { user } = req;
            const { date, include_network } = req.query;
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
            try {
                const currentAccount = await this.controller.getAllCurrentAccountNetworkHandler({
                    user_type: user.user.user_type,
                    user_id: user.user.user_id,
                    date: date,
                    organization_id: req.organization_id,
                    include_network: toBool(include_network),
                });
                const response = {
                    data: {
                        currentAccount,
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
        this.calculateCurrentAccountHandler = async (req, res) => {
            const { user } = req;
            const { date } = req.query;
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
            // Validar que el usuario no sea CASHIER ni ADMIN
            if (user.user.user_type === USER_TYPE.CASHIER || user.user.user_type === USER_TYPE.ADMIN) {
                const response = {
                    error: {
                        error: ERROR_TYPE.AUTH_ERROR,
                        message: 'Access denied: CASHIER and ADMIN users cannot perform this action',
                    },
                };
                res.status(403).json(response);
                return;
            }
            try {
                // Calculate solo recalcula, no liquida (leave = false)
                const currentaccount = await this.controller.calculateCurrentAccountHandler(req.organization_id, date, false, false);
                const response = {
                    data: {
                        currentaccount: currentaccount,
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
        this.liquidateCurrentAccountHandler = async (req, res) => {
            const { user } = req;
            const { date, leave } = req.query;
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
            // Validar que el usuario no sea CASHIER ni ADMIN
            if (user.user.user_type === USER_TYPE.CASHIER || user.user.user_type === USER_TYPE.ADMIN) {
                const response = {
                    error: {
                        error: ERROR_TYPE.AUTH_ERROR,
                        message: 'Access denied: CASHIER and ADMIN users cannot perform this action',
                    },
                };
                res.status(403).json(response);
                return;
            }
            try {
                // Liquidate liquida y puede marcar como leave
                const currentaccount = await this.controller.calculateCurrentAccountHandler(req.organization_id, date, typeof leave === 'string' && leave === 'true', true);
                const response = {
                    data: {
                        currentaccount: currentaccount,
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
        this.updateCurrentAccountHandler = async (req, res) => {
            const { user } = req;
            const { id: current_account_id } = req.params;
            const { updateCurrentAccount } = req.body;
            const { leave } = req.query;
            if (!user?.user || !updateCurrentAccount) {
                const response = {
                    error: {
                        error: ERROR_TYPE.BAD_REQUEST,
                        message: ERROR_MESSAGE.BAD_REQUEST,
                    },
                };
                res.status(500).json(response);
                return;
            }
            // Validar que el usuario no sea CASHIER ni ADMIN
            if (user.user.user_type === USER_TYPE.CASHIER || user.user.user_type === USER_TYPE.ADMIN) {
                const response = {
                    error: {
                        error: ERROR_TYPE.AUTH_ERROR,
                        message: 'Access denied: CASHIER and ADMIN users cannot perform this action',
                    },
                };
                res.status(403).json(response);
                return;
            }
            try {
                const currentaccount = await this.controller.updateCurrentAccountHandler(current_account_id, updateCurrentAccount, req.organization_id, typeof leave === 'string' && leave === 'true');
                const response = {
                    data: {
                        currentaccount,
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
        this.getCurrentAccountHandler = async (req, res) => {
            const { user } = req;
            const { date } = req.query;
            const { id } = req.params;
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
            try {
                const currentAccount = await this.controller.getCurrentAccountHandler({
                    user_type: user.user.user_type,
                    user_id: id,
                    date: typeof date === 'string' ? date : undefined,
                    organization_id: req.organization_id,
                });
                const response = {
                    data: {
                        currentAccount,
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
        this.bulkUpdateCurrentAccountHandler = async (req, res) => {
            const { user } = req;
            const { date, leave } = req.query; // DD-MM-YYYY
            const leaveFlag = toBool(leave);
            const body = req.body;
            const updateCurrentAccount = body?.updateCurrentAccount;
            if (!user?.user) {
                const response = {
                    error: { error: ERROR_TYPE.AUTH_ERROR, message: ERROR_MESSAGE.INVALID_CREDENTIALS },
                };
                res.status(401).json(response);
                return;
            }
            // Validar que el usuario no sea CASHIER ni ADMIN
            if (user.user.user_type === USER_TYPE.CASHIER || user.user.user_type === USER_TYPE.ADMIN) {
                const response = {
                    error: {
                        error: ERROR_TYPE.AUTH_ERROR,
                        message: 'Access denied: CASHIER and ADMIN users cannot perform this action',
                    },
                };
                res.status(403).json(response);
                return;
            }
            // fecha requerida siempre (seguimos tu regla actual)
            if (!date || typeof date !== 'string') {
                const response = {
                    error: {
                        error: ERROR_TYPE.BAD_REQUEST,
                        message: 'Query param "date" (DD-MM-YYYY) es requerido',
                    },
                };
                res.status(400).json(response);
                return;
            }
            // validar formato de updateCurrentAccount solo si viene y no es objeto
            if (updateCurrentAccount !== undefined &&
                (typeof updateCurrentAccount !== 'object' || Array.isArray(updateCurrentAccount))) {
                const response = {
                    error: {
                        error: ERROR_TYPE.BAD_REQUEST,
                        message: 'Body must include "updateCurrentAccount" as an object when provided',
                    },
                };
                res.status(400).json(response);
                return;
            }
            const entries = updateCurrentAccount ? Object.entries(updateCurrentAccount) : [];
            try {
                let updated = [];
                let failed = [];
                // 1) Si hay updates, los aplico (si no, lo salto sin error)
                if (entries.length > 0) {
                    const results = await Promise.allSettled(entries.map(([id, payload]) => this.controller.updateCurrentAccountByUserHandler(id, payload, req.organization_id)));
                    results.forEach((r, idx) => {
                        const [id] = entries[idx];
                        if (r.status === 'fulfilled')
                            updated.push(r.value);
                        else {
                            const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
                            failed.push({ id, error: reason });
                        }
                    });
                }
                // 2) Siempre ejecuto el cálculo del día (regla nueva: aunque no haya updates y leave=false)
                //    `liquidatedFlag` viaja al controller para tu lógica de "liquidado" del día.
                await this.controller.calculateCurrentAccountHandler(req.organization_id, String(date), leaveFlag, true);
                const statusCode = failed.length ? 207 : 200;
                const response = {
                    data: {
                        result: { updated, failed },
                    },
                };
                res.status(statusCode).json(response);
                return;
            }
            catch (error) {
                console.error(error);
                const message = error instanceof Error ? error.message : 'Unknown error';
                let statusCode = 500;
                if (message === ERROR_MESSAGE.USER_NOT_FOUND ||
                    message === ERROR_MESSAGE.INVALID_CREDENTIALS) {
                    statusCode = 401;
                }
                const response = {
                    error: { error: ERROR_TYPE.AUTH_ERROR, message },
                };
                res.status(statusCode).json(response);
                return;
            }
        };
        // Network handlers for CAPITALIST users
        this.calculateNetworkCurrentAccountHandler = async (req, res) => {
            const { user } = req;
            const { date } = req.query;
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
            // Only CAPITALIST and OWNER can calculate network
            if (user.user.user_type !== USER_TYPE.CAPITALIST && user.user.user_type !== USER_TYPE.OWNER) {
                const response = {
                    error: {
                        error: ERROR_TYPE.AUTH_ERROR,
                        message: 'Access denied: Only CAPITALIST and OWNER can calculate network accounts',
                    },
                };
                res.status(403).json(response);
                return;
            }
            try {
                const currentaccount = await this.controller.calculateCurrentAccountNetworkHandler(req.organization_id, date, false, false);
                const response = {
                    data: {
                        currentaccount: currentaccount,
                    },
                };
                res.status(200).json(response);
            }
            catch (error) {
                console.error(error);
                if (error instanceof Error) {
                    const response = {
                        error: {
                            error: ERROR_TYPE.AUTH_ERROR,
                            message: error.message,
                        },
                    };
                    res.status(500).json(response);
                    return;
                }
            }
        };
        this.liquidateNetworkCurrentAccountHandler = async (req, res) => {
            const { user } = req;
            const { date, leave } = req.query;
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
            // Only CAPITALIST and OWNER can liquidate network
            if (user.user.user_type !== USER_TYPE.CAPITALIST && user.user.user_type !== USER_TYPE.OWNER) {
                const response = {
                    error: {
                        error: ERROR_TYPE.AUTH_ERROR,
                        message: 'Access denied: Only CAPITALIST and OWNER can liquidate network accounts',
                    },
                };
                res.status(403).json(response);
                return;
            }
            try {
                const currentaccount = await this.controller.calculateCurrentAccountNetworkHandler(req.organization_id, date, typeof leave === 'string' && leave === 'true', true);
                const response = {
                    data: {
                        currentaccount: currentaccount,
                    },
                };
                res.status(200).json(response);
            }
            catch (error) {
                console.error(error);
                if (error instanceof Error) {
                    const response = {
                        error: {
                            error: ERROR_TYPE.AUTH_ERROR,
                            message: error.message,
                        },
                    };
                    res.status(500).json(response);
                    return;
                }
            }
        };
        this.getNetworkSummaryHandler = async (req, res) => {
            const { user } = req;
            const { date } = req.query;
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
            // Only CAPITALIST and OWNER can view network summary
            if (user.user.user_type !== USER_TYPE.CAPITALIST && user.user.user_type !== USER_TYPE.OWNER) {
                const response = {
                    error: {
                        error: ERROR_TYPE.AUTH_ERROR,
                        message: 'Access denied: Only CAPITALIST and OWNER can view network summary',
                    },
                };
                res.status(403).json(response);
                return;
            }
            try {
                const summary = await this.controller.getNetworkSummaryHandler(req.organization_id, date);
                const response = {
                    data: {
                        summary,
                    },
                };
                res.status(200).json(response);
            }
            catch (error) {
                console.error(error);
                if (error instanceof Error) {
                    const response = {
                        error: {
                            error: ERROR_TYPE.AUTH_ERROR,
                            message: error.message,
                        },
                    };
                    res.status(500).json(response);
                    return;
                }
            }
        };
        this.router = Router();
        this.controller = new CurrentAccountController();
        this.setupRoutes();
    }
    setupRoutes() {
        this.router.get('/network/summary', this.getNetworkSummaryHandler);
        this.router.get('/:id', this.getCurrentAccountHandler);
        this.router.get('/', this.getAllCurrentAccountHandler);
        this.router.post('/calculate', this.calculateCurrentAccountHandler);
        this.router.post('/calculate/network', this.calculateNetworkCurrentAccountHandler);
        this.router.post('/liquidate', this.liquidateCurrentAccountHandler);
        this.router.post('/liquidate/network', this.liquidateNetworkCurrentAccountHandler);
        this.router.post('/', this.calculateCurrentAccountHandler); // Mantener por compatibilidad
        this.router.put('/bulk', this.bulkUpdateCurrentAccountHandler);
        this.router.put('/:id', this.updateCurrentAccountHandler);
    }
}
