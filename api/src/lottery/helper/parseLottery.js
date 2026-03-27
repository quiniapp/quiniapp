export const parseLottery = (lottery) => {
    return {
        active: lottery.active,
        lottery_id: lottery.lottery_id,
        name: lottery.name,
        order: lottery.order,
    };
};
