import { ILotteryEntityBack } from '@helper/types/lottery.type';
import { IUpdateLotteryEntity } from '@helper/request/lottery.request';
export declare class LotteryRepository {
  getById(id: string, organization_id: string): Promise<any>;
  getAll(organization_id: string, all?: boolean): Promise<any[]>;
  create(payload: ILotteryEntityBack): Promise<any>;
  update(id: string, payload: IUpdateLotteryEntity, organization_id: string): Promise<any>;
  delete(id: string, organization_id: string): Promise<void>;
  getNextOrder(organization_id: string): Promise<number>;
}
