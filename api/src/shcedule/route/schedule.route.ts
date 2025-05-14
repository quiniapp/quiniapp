import { Request, RequestHandler, Response, Router } from 'express';
import { ScheduleController } from '../controller/schedule.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { validateUUID } from 'api/helper/validateUUID';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { ScheduleSchema } from '../helper/scheduleSchema';

export class ScheduleRouter {
  public router: Router;

  private controller: ScheduleController;

  constructor() {
    this.router = Router();
    this.controller = new ScheduleController();
    this.setupRoutes();
  }

  private setupRoutes() {
    // this.router.get('/:id', this.getScheduleHandler);
    this.router.get('/', this.getAllScheduleHandler);
    this.router.post('/', this.newSchedulehandler);
    this.router.put('/:id', this.updateScheduleHandler);
    this.router.delete('/:id', this.deleteScheduleHandler);
  }

  private newSchedulehandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { newSchedule } = req.body;
    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: ERROR_MESSAGE.FORBIDDEN,
        },
      };
      res.status(403).json(response);
      return;
    }

    const result = ScheduleSchema.safeParse(newSchedule);
    if (!result.success) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: String(result.error.message),
        },
      };
      res.status(400).json(response); // <-- SIN return

      return;
    }

    try {
      const schedule = await this.controller.create(newSchedule);
      const response: APIResponse<IScheduleEntityFront> = {
        data: {
          schedule,
        },
      };
      res.status(200).json(response);
      return;
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        let statusCode = 500;
        if (
          error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
          error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
        ) {
          statusCode = 401;
        }

        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.AUTH_ERROR,
            message: error.message,
          },
        };
        res.status(statusCode).json(response);
        return;
      }
    }
  };

  private getAllScheduleHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user || !user?.user) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: ERROR_MESSAGE.BAD_REQUEST,
        },
      };
      res.status(403).json(response);
      return;
    }
    try {
      const schedule = await this.controller.getAll(user?.user?.user_type);
      const response: APIResponse<IScheduleEntityFront[]> = {
        data: {
          schedule,
        },
      };
      res.status(200).json(response);
      return;
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        let statusCode = 500;
        if (
          error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
          error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
        ) {
          statusCode = 401;
        }

        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.AUTH_ERROR,
            message: error.message,
          },
        };
        res.status(statusCode).json(response);
        return;
      }
    }
  };
  private updateScheduleHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: schedule_id } = req.params;
    const { updateSchedule } = req.body;
    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: ERROR_MESSAGE.FORBIDDEN,
        },
      };
      res.status(403).json(response);
      return;
    }

    const isValid = validateUUID.safeParse({ schedule_id });
    if (!isValid.success) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.INVALID_ID,
          message: ERROR_MESSAGE.INVALID_ID,
        },
      };
      res.status(403).json(response);
      return;
    }

    const result = ScheduleSchema.safeParse(updateSchedule);
    if (!result.success) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: String(result.error.message),
        },
      };
      res.status(400).json(response); // <-- SIN return

      return;
    }

    try {
      const schedule = await this.controller.update(schedule_id, updateSchedule);
      const response: APIResponse<IScheduleEntityFront> = {
        data: {
          schedule,
        },
      };
      res.status(200).json(response);
      return;
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        let statusCode = 500;
        if (
          error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
          error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
        ) {
          statusCode = 401;
        }

        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.AUTH_ERROR,
            message: error.message,
          },
        };
        res.status(statusCode).json(response);
        return;
      }
    }
  };
  private deleteScheduleHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: schedule_id } = req.params;
    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: ERROR_MESSAGE.FORBIDDEN,
        },
      };
      res.status(403).json(response);
      return;
    }

    const isValid = validateUUID.safeParse({ schedule_id });
    if (!isValid.success) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.INVALID_ID,
          message: ERROR_MESSAGE.INVALID_ID,
        },
      };
      res.status(403).json(response);
      return;
    }
    try {
      await this.controller.delete({ schedule_id });
      res.status(200);
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        let statusCode = 500;
        if (
          error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
          error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
        ) {
          statusCode = 401;
        }

        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.AUTH_ERROR,
            message: error.message,
          },
        };
        res.status(statusCode).json(response);
        return;
      }
    }
  };
}
