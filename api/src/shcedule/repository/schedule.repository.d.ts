import { IScheduleEntityBack } from '@helper/types/schedule.type';
import { IUpdateScheduleEntity } from '@helper/request/schedule.request';
export declare class ScheduleRepository {
  getById(id: string, organization_id: string): Promise<any>;
  getAll(organization_id: string, all?: boolean): Promise<any[]>;
  create(
    payload: Omit<
      IScheduleEntityBack,
      'schedule_id' | 'created_at' | 'edited_at' | 'schedule_lotteries'
    >
  ): Promise<any>;
  update(id: string, payload: IUpdateScheduleEntity, organization_id: string): Promise<any>;
  delete(id: string, organization_id: string): Promise<void>;
}
