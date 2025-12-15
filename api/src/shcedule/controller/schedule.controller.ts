import { ScheduleRepository } from '../repository/schedule.repository';
import { IScheduleEntityBack, IScheduleEntityFront } from '@helper/types/schedule.type';
import {
  IDeleteScheduleEntity,
  IGetScheduleEntity,
  INewScheduleEntity,
  IUpdateScheduleEntity,
} from '@helper/request/schedule.request';
import { scheduleBase } from '../helper/scheduleBase';
import { parseSchedule } from '../helper/parseSchedule';

export class ScheduleController {
  private repository = new ScheduleRepository();

  create = async (
    props: INewScheduleEntity,
    organization_id: string
  ): Promise<IScheduleEntityFront> => {
    console.log('controller', props);
    try {
      const newSchedule = scheduleBase(props, organization_id);
      const schedule = await this.repository.create(newSchedule);
      return parseSchedule(schedule);
    } catch (error) {
      console.error('Controller creation error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  get = async (
    props: IGetScheduleEntity,
    organization_id: string
  ): Promise<IScheduleEntityFront> => {
    try {
      const schedule = await this.repository.getById(props.schedule_id, organization_id);
      return parseSchedule(schedule);
    } catch (error) {
      console.error('Get error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getAll = async (organization_id: string, all?: boolean): Promise<IScheduleEntityFront[]> => {
    try {
      const schedules: IScheduleEntityBack[] = await this.repository.getAll(organization_id, all);

      return schedules.map((schedule) => {
        return parseSchedule(schedule);
      });
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  update = async (
    id: string,
    props: IUpdateScheduleEntity,
    organization_id: string
  ): Promise<IScheduleEntityFront> => {
    try {
      const schedule = await this.repository.update(id, props, organization_id);
      return parseSchedule(schedule);
    } catch (error) {
      console.error('Update error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  delete = async (props: IDeleteScheduleEntity, organization_id: string) => {
    try {
      await this.repository.delete(props.schedule_id, organization_id);
      return;
    } catch (error) {
      console.error('Delete error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
}
