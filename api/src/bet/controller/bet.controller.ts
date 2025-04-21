import { Request, Response } from 'express';
import { BetRepository } from '../repository/bet.repository';

export class BetController {
  private repository = new BetRepository();

  get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.repository.getById(id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error retrieving Bet', details: error });
    }
  };

  getAll = async (req: Request, res: Response) => {
    try {
      const result = await this.repository.getAll();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error retrieving Bets', details: error });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const result = await this.repository.create(body);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error creating Bet', details: error });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body;
      const result = await this.repository.update(id, body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error updating Bet', details: error });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.repository.delete(id);
      res.json({ message: 'Deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Error deleting Bet', details: error });
    }
  };
}
