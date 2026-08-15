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
import { moduleSettingsRoutes } from './module-settings.routes.js';
import { pushCronRoutes, pushRoutes } from './push.routes.js';

/**
 * Registro central de rotas. Cada modulo entregue nas proximas etapas
 * (assignments, exams, calendar...) e plugado aqui.
 */
export const routes: Router = Router();

routes.use(healthRoutes);
// `pushCronRoutes` (só `GET /push/dispatch`, sem `.use(authenticate)`
// nenhum) precisa estar antes de qualquer router com `.use(authenticate)`
// sem caminho (todos os que exigem sessão, abaixo) - esse middleware roda
// para QUALQUER path que caia no router, mesmo um que nenhuma rota sua
// atenda, e barraria o pedido (401) antes de ele alcançar a rota certa.
// `authRoutes` segue a mesma regra pelo mesmo motivo - é por isso que vem
// logo em seguida, e não lá no meio da lista. `pushRoutes` (subscribe/
// unsubscribe, autenticado) fica registrado mais abaixo, junto dos outros
// routers que exigem sessão - a ordem entre eles não importa.
routes.use(pushCronRoutes);
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
routes.use(moduleSettingsRoutes);
routes.use(pushRoutes);
