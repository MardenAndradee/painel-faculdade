import { Router } from 'express';
import {
  createSemesterSchema,
  gradeConfigurationInputSchema,
  propagateGradeTemplateSchema,
  updateSemesterSchema,
} from '@painel/shared';
import { semesterController } from '../controllers/semester.controller.js';
import { gradeConfigurationController } from '../controllers/grade-configuration.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/subject.validators.js';

/** Rotas de semestres e historico. Todas exigem sessao ativa. */
export const semesterRoutes: Router = Router();

semesterRoutes.use(authenticate);

// Historico academico agrupado.
semesterRoutes.get('/history', semesterController.history);

semesterRoutes.get('/semesters', semesterController.list);

semesterRoutes.post(
  '/semesters',
  validate({ body: createSemesterSchema }),
  semesterController.create,
);

semesterRoutes.get(
  '/semesters/:id',
  validate({ params: idParamSchema }),
  semesterController.getById,
);

semesterRoutes.get(
  '/semesters/:id/close-preview',
  validate({ params: idParamSchema }),
  semesterController.previewClose,
);

semesterRoutes.post(
  '/semesters/:id/close',
  validate({ params: idParamSchema }),
  semesterController.close,
);

semesterRoutes.post(
  '/semesters/:id/reopen',
  validate({ params: idParamSchema }),
  semesterController.reopen,
);

semesterRoutes.patch(
  '/semesters/:id',
  validate({ params: idParamSchema, body: updateSemesterSchema }),
  semesterController.update,
);

semesterRoutes.delete(
  '/semesters/:id',
  validate({ params: idParamSchema }),
  semesterController.remove,
);

// --- Modelo padrao de notas (Etapa 17) ----------------------------------------
// So pre-preenche disciplinas novas - nunca compartilhado, cada disciplina tem
// sua propria configuracao independente.

semesterRoutes.get(
  '/semesters/:id/grade-configuration-template',
  validate({ params: idParamSchema }),
  gradeConfigurationController.getTemplateForSemester,
);

semesterRoutes.put(
  '/semesters/:id/grade-configuration-template',
  validate({ params: idParamSchema, body: gradeConfigurationInputSchema }),
  gradeConfigurationController.replaceTemplateForSemester,
);

// --- Propagacao do modelo (Etapa 18) ------------------------------------------
// Editar o modelo continua nao mexendo em disciplina nenhuma. Estas duas rotas
// sao o passo explicito: a previa mostra o que mudaria, e so as disciplinas
// enviadas na confirmacao recebem a fusao (aditiva).

semesterRoutes.get(
  '/semesters/:id/grade-configuration-template/propagation-preview',
  validate({ params: idParamSchema }),
  gradeConfigurationController.previewPropagation,
);

semesterRoutes.post(
  '/semesters/:id/grade-configuration-template/propagate',
  validate({ params: idParamSchema, body: propagateGradeTemplateSchema }),
  gradeConfigurationController.propagateToSubjects,
);
