export interface ITokenPayload {
  user_id: string;
  token: string;
}
export interface IAuthLogin {
  username: string;
  password: string;
}
export interface IAuthLogout {
  user_id: string;
  token: string;
}
