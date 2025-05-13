import bcrypt from 'bcryptjs';
import { JWT } from './JWT';
import { supabase } from '../database/db.connection';

export class Auth {
  static async validateUser(username: string, password: string) {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error || !user) {
      throw new Error('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      throw new Error('Invalid credentials');
    }

    return user;
  }

  static async login(username: string, password: string) {
    const user = await Auth.validateUser(username, password);

    const accessToken = JWT.generateAccessToken({
      user_id: user.user_id,
      username: user.username,
      user_type: user.user_type,
    });

    const refreshToken = JWT.generateRefreshToken({
      user_id: user.user_id,
    });

    return { accessToken, refreshToken };
  }

  static async refreshSession(refreshToken: string) {
    try {
      const payload = JWT.verifyRefreshToken(refreshToken) as any;

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', payload.user_id)
        .maybeSingle();

      if (error || !user) {
        throw new Error('User not found');
      }

      const newAccessToken = JWT.generateAccessToken({
        user_id: user.user_id,
        username: user.username,
        user_type: user.user_type,
      });

      return { accessToken: newAccessToken };
    } catch (err) {
      console.log(err);
      throw new Error();
    }
  }
}
