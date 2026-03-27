import { BetRepository } from '../repository/bet.repository';
import { parseBet } from '../helper/parseBet';
export class BetController {
    constructor() {
        this.repository = new BetRepository();
        this.getAllBets = async ({ schedule_id, date, cashier_id, lottery_id, winners, grouped, tern, quatern, ticket_number, organization_ids, page = 1, limit = 100, }) => {
            try {
                if (grouped) {
                    const { data: groupedBets, count } = await this.repository.getAllBetsGrouped({
                        organization_ids,
                        schedule_id,
                        date,
                        cashier_id,
                        lottery_id,
                        winners,
                        tern,
                        quatern,
                        page,
                        limit,
                    });
                    const parsedBets = groupedBets.map((bet) => parseBet(bet));
                    const totalPages = Math.ceil(count / limit);
                    return {
                        data: parsedBets,
                        pagination: {
                            currentPage: page,
                            pageSize: limit,
                            totalCount: count,
                            totalPages,
                            hasMore: page < totalPages,
                        },
                    };
                }
                else {
                    // Con paginación
                    const { data: bets, count } = await this.repository.getAllBets({
                        organization_ids,
                        schedule_id,
                        date,
                        cashier_id,
                        lottery_id,
                        winners,
                        tern,
                        quatern,
                        ticket_number,
                        page,
                        limit,
                    });
                    const parsedBets = bets.map((bet) => parseBet(bet));
                    const totalPages = Math.ceil(count / limit);
                    // Si hay ticket_number, obtener totales por ticket
                    let aggregates = {};
                    if (ticket_number) {
                        // Solo calcular sumas del ticket en la primera página
                        if (page === 1) {
                            const ticketSums = await this.repository.getAmountsByTicket({
                                ticket_number,
                                organization_ids,
                            });
                            aggregates = {
                                totalAmount: ticketSums?.total_amount ?? 0,
                                totalPrize: ticketSums?.total_prize ?? 0,
                                totalCount: ticketSums?.total_count ?? 0,
                                totalWinnersCount: ticketSums?.total_winners_count ?? 0,
                            };
                        }
                    }
                    else {
                        // Solo calcular totales en la primera página — no cambian entre páginas
                        if (page === 1) {
                            const [totalAmount, totalPrize] = await Promise.all([
                                this.repository.getTotalAmount({
                                    date,
                                    schedule_id,
                                    cashier_id,
                                    lottery_id,
                                    organization_ids,
                                }),
                                this.repository.getTotalPrize({
                                    date,
                                    schedule_id,
                                    cashier_id,
                                    lottery_id,
                                    organization_ids,
                                }),
                            ]);
                            aggregates = {
                                totalAmount,
                                totalPrize,
                            };
                        }
                        // Pages 2+ no recalculan — el frontend usa data?.pages?.[0]?.aggregates
                    }
                    return {
                        data: parsedBets,
                        pagination: {
                            currentPage: page,
                            pageSize: limit,
                            totalCount: count,
                            totalPages,
                            hasMore: page < totalPages,
                        },
                        aggregates,
                    };
                }
            }
            catch (error) {
                console.error('GetAll error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.getTotalAmount = async ({ date, schedule_id, cashier_id, lottery_id, organization_ids, }) => {
            try {
                const total = await this.repository.getTotalAmount({
                    date,
                    schedule_id,
                    cashier_id,
                    lottery_id,
                    organization_ids,
                });
                return total;
            }
            catch (error) {
                console.error('GetTotalAmount error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.getTotalPrize = async ({ date, schedule_id, cashier_id, lottery_id, organization_ids, }) => {
            try {
                const total = await this.repository.getTotalPrize({
                    date,
                    schedule_id,
                    cashier_id,
                    lottery_id,
                    organization_ids,
                });
                return total;
            }
            catch (error) {
                console.error('GetTotalPrize error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
        this.getAmountsByTicket = async ({ ticket_number, organization_ids, }) => {
            try {
                // Repository handles searching in both main and archive tables
                const totals = await this.repository.getAmountsByTicket({
                    ticket_number,
                    organization_ids,
                });
                return totals;
            }
            catch (error) {
                console.error('getAmountsByTicket error:', error);
                throw error instanceof Error ? error : new Error('Unknown error');
            }
        };
    }
}
