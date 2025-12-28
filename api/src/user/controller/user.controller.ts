import { UserRepository } from '../repository/user.repository';
import {
  IDeleteUserEntity,
  IGetUserEntity,
  INewUserEntity,
  IUpdateUserEntity,
} from '@helper/request/user.request';
import { CASHIER_TYPE, IUserEntityFront } from '@helper/types/user.type';
import { parseUser } from '../helper/parseUser';
import { buildUserForDB } from '../helper/userBase';
import { supabase } from 'api/database/db.connection';
import { InternalServerError } from '@helper/errors';
// import { generateEmail } from 'helper/generateEmail';

export class UserController {
  private repository = new UserRepository();

  create = async (newUser: INewUserEntity, organization_id: string): Promise<IUserEntityFront> => {
    const user = await buildUserForDB(newUser, organization_id);
    const result = await this.repository.create(user);

    if (user.cashier_type !== CASHIER_TYPE.STREET) {
      const { error } = await supabase.auth.signUp({
        email: user.email!,
        password: newUser.password,
      });

      if (error) {
        await this.repository.deleteFailedUser(result.user_id);
        throw new InternalServerError(error.message);
      }
    }

    return parseUser(result);
  };
  get = async (props: IGetUserEntity, organization_id: string): Promise<IUserEntityFront> => {
    const result = await this.repository.getById(props.user_id!, organization_id);
    return parseUser(result);
  };

  getAll = async (
    organization_id: string,
    cashier_number?: number
  ): Promise<IUserEntityFront[]> => {
    const result = await this.repository.getAll(organization_id, cashier_number);
    return result.map((user) => parseUser(user));
  };

  update = async (
    user_id: string,
    props: IUpdateUserEntity,
    organization_id: string
  ): Promise<IUserEntityFront> => {
    const result = await this.repository.update(user_id, props, organization_id);

    return parseUser(result);
  };

  delete = async (props: IDeleteUserEntity, organization_id: string) => {
    const response = await this.repository.delete(props.user_id, organization_id);
    return parseUser(response);
  };
}
