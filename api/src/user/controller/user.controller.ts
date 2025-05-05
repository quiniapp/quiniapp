import { Request, Response } from 'express';
import { UserRepository } from '../repository/user.repository';
import { INewUserEntity } from '@helper/request/user.response';
import { IUserEntityFront } from '@helper/types/user.type';
import { parseUser } from '../helper/parseUser';

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
    try {
      const result = await this.repository.create(newUser);

      return parseUser(result);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Creation error:', error.message);

        throw error; // o volver a lanzar para que la capa superior lo maneje
      }
      throw new Error('Unknown error during user creation');
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
