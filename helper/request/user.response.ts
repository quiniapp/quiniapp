import { IUserEntityBack } from "@helper/types/user.type";

export type INewUserEntity = Partial<Pick<IUserEntityBack, 'username' | 'password' | 'user_type' | 'cashier_number' | 'cashier_type' | 'fee' |'fee_plus'>>