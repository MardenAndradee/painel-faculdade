import { Router } from 'express';
import { healthRoutes } from './health.routes.js';
import { authRoutes } from './auth.routes.js';
import { dashboardRoutes } from './dashboard.routes.js';
import { subjectRoutes } from './subject.routes.js';
import { assignmentRoutes } from './assignment.routes.js';
import { examRoutes } from './exam.routes.js';
import { calendarRoutes } from './calendar.routes.js';
import { integrationRoutes } from './integration.routes.js';
import { gradeRoutes } from './grade.routes.js';
import { semesterRoutes } from './semester.routes.js';
import { attachmentRoutes } from './attachment.routes.js';
import { flashcardRoutes } from './flashcard.routes.js';
import { studyPlanRoutes } from './study-plan.routes.js';
import { examPrepRoutes } from './exam-prep.routes.js';
import { statisticsRoutes } from './statistics.routes.js';
import { noteRoutes } from './note.routes.js';
import { searchRoutes } from './search.routes.js';
import { notificationRoutes } from './notification.routes.js';
import { classRoutes } from './class.routes.js';

/**
 * Registro central de rotas. Cada modulo entregue nas proximas etapas
 * (assignments, exams, calendar...) e plugado aqui.
 */
export const routes: Router = Router();

routes.use(healthRoutes);
routes.use(authRoutes);
routes.use(dashboardRoutes);
routes.use(subjectRoutes);
routes.use(assignmentRoutes);
routes.use(examRoutes);
routes.use(calendarRoutes);
routes.use(integrationRoutes);
routes.use(gradeRoutes);
routes.use(semesterRoutes);
routes.use(attachmentRoutes);
routes.use(flashcardRoutes);
routes.use(studyPlanRoutes);
routes.use(examPrepRoutes);
routes.use(statisticsRoutes);
routes.use(noteRoutes);
routes.use(searchRoutes);
routes.use(notificationRoutes);
routes.use(classRoutes);
