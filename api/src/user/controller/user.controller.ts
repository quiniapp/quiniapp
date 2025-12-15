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
// import { generateEmail } from 'helper/generateEmail';

export class UserController {
  private repository = new UserRepository();

  create = async (newUser: INewUserEntity, organization_id: string): Promise<IUserEntityFront> => {
    const user = await buildUserForDB(newUser);
    try {
      const result = await this.repository.create(user, organization_id);
      if (user.cashier_type !== CASHIER_TYPE.STREET) {
        const { error } = await supabase.auth.signUp({
          email: user.email!,
          password: newUser.password,
        });

        if (error) {
          await this.repository.deleteFailedUser(result.user_id, organization_id);
          console.error('Supabase creation error:', error);
          throw new Error(error.message);
        }
      }

      return parseUser(result);
    } catch (error) {
      console.error('Creation error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  get = async (props: IGetUserEntity): Promise<IUserEntityFront> => {
    try {
      const result = await this.repository.getById(props.user_id!, props.organization_id!);

      return parseUser(result);
    } catch (error) {
      console.error('Get error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  getAll = async (
    organization_id: string,
    cashier_number?: number
  ): Promise<IUserEntityFront[]> => {
    try {
      const result = await this.repository.getAll(organization_id, cashier_number);
      return result.map((user) => parseUser(user));
    } catch (error) {
      console.error('GetAll error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  update = async (user_id: string, props: IUpdateUserEntity): Promise<IUserEntityFront> => {
    try {
      const result = await this.repository.update(user_id, props, props.organization_id);

      // TO DO: validar el password despues
      // if (user.cashier_type !== CASHIER_TYPE.STREET) {
      //   const { error } = await supabase.auth.signUp({
      //     email: user.email!,
      //     password: newUser.password,
      //   });

      //   if (error) {
      //     await this.repository.delete(result.user_id);
      //     console.error('Supabase creation error:', error);
      //     throw new Error(error.message);
      //   }
      // }

      return parseUser(result);
    } catch (error) {
      console.error('pdate error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  delete = async (props: IDeleteUserEntity) => {
    try {
      const response = await this.repository.delete(props.user_id, props.organization_id);
      return parseUser(response);
    } catch (error) {
      console.error('Delete error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };
  // updatePassword = async (user_id: string) => {
  //   try {
  //     const user = await this.repository.getById(user_id);
  //     const response = await supabase.auth.resetPasswordForEmail(generateEmail(user.username), {
  //       redirectTo: 'http://localhost:5173/reset-password',
  //     });
  //     console.log(response);
  //   } catch (error) {
  //     console.error('Delete error:', error);
  //     throw error instanceof Error ? error : new Error('Unknown error');
  //   }
  // };
}
