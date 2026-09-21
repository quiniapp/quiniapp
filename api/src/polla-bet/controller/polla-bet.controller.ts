import { PollaBetRepository } from '../repository/polla-bet.repository';
import { INewPollaBetEntity, IUpdatePollaBetEntity } from '@helper/request/polla-bet.request';
import { parsePollaBet } from '../helper/parsePollaBet';
import { IPollaBetEntityFront } from '@helper/types/polla-bet.type';

export class PollaBetController {
  private repository = new PollaBetRepository();

  create = async (
    props: INewPollaBetEntity,
    organization_id: string
  ): Promise<IPollaBetEntityFront> => {
    const result = await this.repository.create({ ...props, organization_id });
    return parsePollaBet(result);
  };

  getAll = async ({
    organization_id,
    user_id,
    polla_edition_id,
    lottery_id,
    schedule_id,
    date,
    ticket_number,
  }: {
    organization_id: string;
    user_id?: string;
    polla_edition_id?: string;
    lottery_id?: string;
    schedule_id?: string;
    date?: string;
    ticket_number?: string;
  }): Promise<IPollaBetEntityFront[]> => {
    const bets = await this.repository.getAll({
      organization_id,
      user_id,
      polla_edition_id,
      lottery_id,
      schedule_id,
      date,
      ticket_number,
    });
    return bets.map(parsePollaBet);
  };

  update = async (
    polla_bet_id: string,
    props: IUpdatePollaBetEntity,
    organization_id: string
  ): Promise<IPollaBetEntityFront> => {
    const result = await this.repository.update({
      polla_bet_id,
      numbers: props.numbers,
      organization_id,
    });
    return parsePollaBet(result);
  };

  delete = async (polla_bet_id: string, organization_id: string, deleted_by: string) => {
    await this.repository.delete({ polla_bet_id, organization_id, deleted_by });
  };
}
