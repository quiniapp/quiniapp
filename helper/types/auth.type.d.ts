import { IUserEntityFront } from './user.type';
export interface ITokenPayload {
  user: IUserEntityFront;
  token: string;
  organization_id: string;
}
export interface IAuthLogin {
  username: string;
  password: string;
}
export interface IAuthLogout {
  user_id: string;
  token: string;
}
