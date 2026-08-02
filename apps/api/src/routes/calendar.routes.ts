import { Router } from 'express';
import {
  calendarRangeSchema,
  createCalendarEventSchema,
  updateCalendarEventSchema,
} from '@painel/shared';
import { calendarController } from '../controllers/calendar.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/subject.validators.js';

/** Rotas do calendario. Todas exigem sessao ativa. */
export const calendarRoutes: Router = Router();

calendarRoutes.use(authenticate);

// Agenda agregada: provas, entregas e eventos no mesmo formato.
calendarRoutes.get(
  '/calendar',
  validate({ query: calendarRangeSchema }),
  calendarController.agenda,
);

// CRUD dos eventos proprios.
calendarRoutes.post(
  '/calendar/events',
  validate({ body: createCalendarEventSchema }),
  calendarController.createEvent,
);

calendarRoutes.get(
  '/calendar/events/:id',
  validate({ params: idParamSchema }),
  calendarController.getEvent,
);

calendarRoutes.patch(
  '/calendar/events/:id',
  validate({ params: idParamSchema, body: updateCalendarEventSchema }),
  calendarController.updateEvent,
);

calendarRoutes.delete(
  '/calendar/events/:id',
  validate({ params: idParamSchema }),
  calendarController.removeEvent,
);
