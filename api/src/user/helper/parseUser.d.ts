import { IUserEntityBack, IUserEntityFront, IUserWithSessionFront } from '@helper/types/user.type';
type UserWithPossibleSessions = IUserEntityBack & {
  sessions?: Array<{
    last_activity_at: string | Date;
  }>;
};
export declare const parseUser: (
  user: UserWithPossibleSessions
) => IUserEntityFront | IUserWithSessionFront;
export {};
