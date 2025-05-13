import { Request, Response } from 'express';
import { UserRepository } from '../repository/user.repository';
import { INewUserEntity } from '@helper/request/user.response';
import { CASHIER_TYPE, IUserEntityFront } from '@helper/types/user.type';
import { parseUser } from '../helper/parseUser';
import { buildUserForDB } from '../helper/userBase';
import { supabase } from 'api/database/db.connection';

export class UserController {
  private repository = new UserRepository();

  get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.repository.getById(id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error retrieving user', details: error });
    }
  };

  getAll = async (req: Request, res: Response) => {
    try {
      const result = await this.repository.getAll();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error retrieving users', details: error });
    }
  };

  create = async (newUser: INewUserEntity): Promise<IUserEntityFront> => {
    const user = await buildUserForDB(newUser);
    try {
      const result = await this.repository.create(user);
      if (user.cashier_type !== CASHIER_TYPE.STREET) {
        const { error } = await supabase.auth.signUp({
          email: user.email!,
          password: newUser.password,
        });

        if (error) {
          await this.repository.delete(result.user_id);
          console.error('Supabase auth error:', error);
          throw new Error(error.message);
        }
      }

      return parseUser(result);
    } catch (error) {
      console.error('Creation error:', error);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body;
      const result = await this.repository.update(id, body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error updating user', details: error });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.repository.delete(id);
      res.json({ message: 'Deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Error deleting user', details: error });
    }
  };
}