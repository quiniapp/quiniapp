// src/controllers/auth.controller.ts
import { Request, Response } from 'express';

export const login = (req: Request, res: Response) => {
  // TODO: Validar credenciales y generar token
  res.status(200).json({ message: 'Login endpoint' });
};

export const logout = (req: Request, res: Response) => {
  // TODO: Invalidar token o limpiar sesión
  res.status(200).json({ message: 'Logout endpoint' });
};
