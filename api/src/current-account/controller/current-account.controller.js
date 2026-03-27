import { USER_TYPE } from '@helper/types/user.type';
import { CurrentAccountRepository } from '../repository/current-account.repository';
import { UserRepository } from '../../user/repository/user.repository';
import { parseCurrentAccount } from '../helper/parseCurrentAccount';
import { ERROR_MESSAGE } from '@helper/types/errors.type';
export class CurrentAccountController {
    constructor() {
        this.repository = new CurrentAccountRepository();
        this.calculateCurrentAccountHandler = async (organization_id, date, leave, liquidated) => {
            try {
                const results = await this.repository.calculateCurrentAccountHandler(organization_id, date, leave, liquidated);
                return results.map((res) => parseCurrentAccount(res));
            }
            catch (error) {
                console.error('Creation error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.getAllCurrentAccountHandler = async (props) => {
            let currentaccounts;
            try {
                if (props.user_type === USER_TYPE.CASHIER) {
                    currentaccounts = await this.repository.getAllCurrentAccountHandler({
                        organization_id: props.organization_id,
                        user_id: props.user_id,
                        date: props.date,
                    });
                }
                else {
                    currentaccounts = await this.repository.getAllCurrentAccountHandler({
                        organization_id: props.organization_id,
                        date: props.date,
                    });
                }
                return currentaccounts.map((currentaccount) => {
                    return parseCurrentAccount(currentaccount);
                });
            }
            catch (error) {
                console.error('getAllCurrentAccountHandler error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.updateCurrentAccountHandler = async (current_account_id, props, organization_id, leave) => {
            try {
                // Construye payload solo con las keys permitidas y definidas
                const payload = {};
                if (props.claims !== undefined)
                    payload.claims = Number(props.claims);
                if (props.paid !== undefined)
                    payload.paid = Number(props.paid);
                if (props.collections !== undefined)
                    payload.collections = Number(props.collections);
                if (props.bills !== undefined)
                    payload.bills = Number(props.bills);
                if (props.previous_drag !== undefined)
                    payload.previous_drag = Number(props.previous_drag);
                if (props.previous_balance !== undefined)
                    payload.previous_balance = Number(props.previous_balance);
                // Llama a tu repo (que a su vez llama al RPC update_current_account_recompute)
                const currentAccount = await this.repository.updateCurrentAccountHandler(current_account_id, organization_id, payload, leave);
                return parseCurrentAccount(currentAccount);
            }
            catch (error) {
                console.error('updateCurrentAccountHandler error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.getCurrentAccountHandler = async (props) => {
            try {
                const currentaccounts = await this.repository.getCurrentAccountByUserHandler(props.user_id, props.organization_id, props.date);
                if (!currentaccounts) {
                    throw new Error(ERROR_MESSAGE.NOT_FOUND);
                }
                return parseCurrentAccount(currentaccounts);
            }
            catch (error) {
                console.error('getCurrentAccountHandler error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.updateCurrentAccountByUserHandler = async (current_account_id, props, organization_id) => {
            try {
                const payload = {};
                if (props.claims !== undefined)
                    payload.claims = Number(props.claims);
                if (props.paid !== undefined)
                    payload.paid = Number(props.paid);
                if (props.collections !== undefined)
                    payload.collections = Number(props.collections);
                if (props.bills !== undefined)
                    payload.bills = Number(props.bills);
                if (props.previous_drag !== undefined)
                    payload.previous_drag = Number(props.previous_drag);
                if (props.previous_balance !== undefined)
                    payload.previous_balance = Number(props.previous_balance);
                // IMPORTANTE: devolvemos la fila actualizada
                return await this.repository.updateCurrentAccountByUserHandler(current_account_id, organization_id, payload);
            }
            catch (error) {
                console.error('updateCurrentAccountByUserHandler error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        // Network-aware methods for CAPITALIST users
        /**
         * Calculate current accounts for entire network (org + sub-orgs)
         */
        this.calculateCurrentAccountNetworkHandler = async (organization_id, date, leave, liquidated) => {
            try {
                const results = await this.repository.calculateCurrentAccountNetworkHandler(organization_id, date, leave, liquidated);
                return results.map((res) => parseCurrentAccount(res));
            }
            catch (error) {
                console.error('calculateCurrentAccountNetworkHandler error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        /**
         * Get all current accounts for network (org + sub-orgs)
         */
        this.getAllCurrentAccountNetworkHandler = async (props) => {
            try {
                let currentaccounts;
                if (props.user_type === USER_TYPE.CASHIER) {
                    // CASHIER solo ve su propia cuenta
                    currentaccounts = await this.repository.getAllCurrentAccountHandler({
                        organization_id: props.organization_id,
                        user_id: props.user_id,
                        date: props.date,
                    });
                }
                else if ([USER_TYPE.CAPITALIST, USER_TYPE.OWNER].includes(props.user_type)) {
                    // CAPITALIST/OWNER siempre ven toda la red
                    currentaccounts = await this.repository.getAllCurrentAccountNetworkHandler({
                        organization_id: props.organization_id,
                        date: props.date,
                    });
                }
                else {
                    // SUPERADMIN/ADMIN: si están en org raíz, ven toda la red; si están en sub-org, solo su org
                    const userRepo = new UserRepository();
                    const isSubOrg = await userRepo.isSubOrganization(props.organization_id);
                    if (isSubOrg) {
                        currentaccounts = await this.repository.getAllCurrentAccountHandler({
                            organization_id: props.organization_id,
                            date: props.date,
                        });
                    }
                    else {
                        currentaccounts = await this.repository.getAllCurrentAccountNetworkHandler({
                            organization_id: props.organization_id,
                            date: props.date,
                        });
                    }
                }
                return currentaccounts.map((currentaccount) => parseCurrentAccount(currentaccount));
            }
            catch (error) {
                console.error('getAllCurrentAccountNetworkHandler error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        /**
         * Get network summary (aggregated totals per organization)
         */
        this.getNetworkSummaryHandler = async (organization_id, date) => {
            try {
                return await this.repository.getNetworkSummaryHandler(organization_id, date);
            }
            catch (error) {
                console.error('getNetworkSummaryHandler error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
    }
}
