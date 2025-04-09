import { Request, Response, NextFunction } from 'express';

export const isAuthenticated = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticación faltante o malformado' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token || token !== 'valid-token') {
    res.status(403).json({ error: 'Token inválido' });
    return;
  }

  next();
};
