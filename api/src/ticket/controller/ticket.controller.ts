import { Request, Response } from 'express';
import { TicketRepository } from '../repository/ticket.repository';

export class TicketController {
  private repository = new TicketRepository();

  get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.repository.getById(id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error retrieving Ticket', details: error });
    }
  };

  getAll = async (req: Request, res: Response) => {
    try {
      const result = await this.repository.getAll();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error retrieving Tickets', details: error });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const result = await this.repository.create(body);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error creating Ticket', details: error });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body;
      const result = await this.repository.update(id, body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Error updating Ticket', details: error });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.repository.delete(id);
      res.json({ message: 'Deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Error deleting Ticket', details: error });
    }
  };
}
