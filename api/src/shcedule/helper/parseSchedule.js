export const parseSchedule = (schedule) => {
    return {
        schedule_id: schedule.schedule_id,
        name: schedule.name,
        time: schedule.time.slice(0.5),
        active: schedule.active,
    };
};
