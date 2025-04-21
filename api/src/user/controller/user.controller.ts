import { Request, Response } from 'express';
import { UserRepository } from '../repository/user.repository';

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

  create = async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const result = await this.repository.create(body);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error creating user', details: error });
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
