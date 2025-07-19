import { ScheduleRepository } from '../repository/schedule.repository';
import { IScheduleEntityBack, IScheduleEntityFront } from '@helper/types/schedule.type';
import {
  IDeleteScheduleEntity,
  IGetScheduleEntity,
  INewScheduleEntity,
  IUpdateScheduleEntity,
} from '@helper/request/schedule.response';
import { scheduleBase } from '../helper/scheduleBase';
import { parseSchedule } from '../helper/parseSchedule';

export class ScheduleController {
  private repository = new ScheduleRepository();

  create = async (props: INewScheduleEntity): Promise<IScheduleEntityFront> => {
    try {
      const newSchedule = scheduleBase(props);
      const schedule = await this.repository.create(newSchedule);
      return parseSchedule(schedule);
    } catch (error) {
      console.error('Creation error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  get = async (props: IGetScheduleEntity): Promise<IScheduleEntityFront> => {
    try {
      const schedule = await this.repository.getById(props.schedule_id);
      return parseSchedule(schedule);
    } catch (error) {
      console.error('Get error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getAll = async (): Promise<IScheduleEntityFront[]> => {
    try {
      const schedules: IScheduleEntityBack[] = await this.repository.getAll();

      return schedules.map((schedule) => {
        return parseSchedule(schedule);
      });
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  update = async (id: string, props: IUpdateScheduleEntity): Promise<IScheduleEntityFront> => {
    try {
      const schedule = await this.repository.update(id, props);
      return parseSchedule(schedule);
    } catch (error) {
      console.error('Update error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  delete = async (props: IDeleteScheduleEntity) => {
    try {
      await this.repository.delete(props.schedule_id);
      return;
    } catch (error) {
      console.error('Delete error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
