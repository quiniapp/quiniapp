export declare class WinnerRepository {
  generateWinners({
    schedule_id,
    date,
    organization_id,
  }: {
    schedule_id: string;
    date: string;
    organization_id: string;
  }): Promise<any>;
  getAllWinners({
    organization_id,
    user_id,
  }: {
    organization_id: string;
    user_id?: string;
  }): Promise<any[]>;
}
