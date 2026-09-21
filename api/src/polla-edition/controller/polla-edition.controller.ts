import { PollaEditionRepository } from '../repository/polla-edition.repository';
import {
  IDeletePollaEditionEntity,
  IGetPollaEditionEntity,
  INewPollaEditionEntity,
  IUpdatePollaEditionEntity,
} from '@helper/request/polla-edition.request';
import { parsePollaEdition } from '../helper/parsePollaEdition';
import { IPollaEditionEntityFront } from '@helper/types/polla-edition.type';

export class PollaEditionController {
  private repository = new PollaEditionRepository();

  create = async (
    props: INewPollaEditionEntity,
    organization_id: string
  ): Promise<IPollaEditionEntityFront> => {
    const result = await this.repository.create({ ...props, organization_id });
    return parsePollaEdition(result);
  };

  get = async (
    props: IGetPollaEditionEntity,
    organization_id: string
  ): Promise<IPollaEditionEntityFront> => {
    const edition = await this.repository.getById(props.polla_edition_id, organization_id);
    return parsePollaEdition(edition);
  };

  getAll = async (
    organization_id: string,
    status?: string
  ): Promise<IPollaEditionEntityFront[]> => {
    const editions = await this.repository.getAll(organization_id, status);
    return editions.map(parsePollaEdition);
  };

  update = async (
    id: string,
    props: IUpdatePollaEditionEntity,
    organization_id: string
  ): Promise<IPollaEditionEntityFront> => {
    const edition = await this.repository.update(id, props, organization_id);
    return parsePollaEdition(edition);
  };

  delete = async (props: IDeletePollaEditionEntity, organization_id: string) => {
    await this.repository.delete(props.polla_edition_id, organization_id);
  };
}
