import { USER_TYPE } from '@helper/types/user.type';
import { parseTicket } from 'api/src/ticket/helper/parseTicket';
import { WinnerRepository } from '../repository/winners.repository';
export class WinnerController {
    constructor() {
        this.repository = new WinnerRepository();
        this.generateWinners = async ({ schedule_id, date, organization_id, }) => {
            try {
                const response = await this.repository.generateWinners({
                    schedule_id,
                    date,
                    organization_id,
                });
                return response;
            }
            catch (error) {
                console.error('Creation error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.getAllWinners = async (props) => {
            let winners;
            try {
                if (props.user_type === USER_TYPE.CASHIER) {
                    winners = await this.repository.getAllWinners({
                        organization_id: props.organization_id,
                        user_id: props.user_id,
                    });
                }
                else {
                    winners = await this.repository.getAllWinners({ organization_id: props.organization_id });
                }
                return winners.map((winner) => {
                    return parseTicket(winner);
                });
            }
            catch (error) {
                console.error('GetAll error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
    }
}
