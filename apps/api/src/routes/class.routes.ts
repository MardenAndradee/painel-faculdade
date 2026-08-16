import { Router } from 'express';
import {
  classSubjectInputSchema,
  createClassAnnouncementSchema,
  createClassInviteSchema,
  createClassMaterialLinkSchema,
  createClassNoteSchema,
  createClassPostSchema,
  createClassSchema,
  transferClassOwnerSchema,
  updateClassAnnouncementSchema,
  updateClassNoteSchema,
  updateClassPostSchema,
  updateClassSchema,
  uploadClassMaterialSchema,
} from '@painel/shared';
import { classController } from '../controllers/class.controller.js';
import { classPostController } from '../controllers/class-post.controller.js';
import { classAnnouncementController } from '../controllers/class-announcement.controller.js';
import { classNoteController } from '../controllers/class-note.controller.js';
import { classMaterialController } from '../controllers/class-material.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { classGuard } from '../middlewares/class-guard.js';
import { classJoinRateLimiter } from '../middlewares/rate-limit.js';
import { validate } from '../middlewares/validate.js';
import { uploadSingleFile } from '../middlewares/upload.js';
import {
  classAnnouncementIdParamSchema,
  classIdParamSchema,
  classInviteIdParamSchema,
  classInviteTokenParamSchema,
  classMaterialIdParamSchema,
  classNoteIdParamSchema,
  classPostIdParamSchema,
  classSubjectIdParamSchema,
  updateClassSubjectSchema,
  upcomingClassPostsQuerySchema,
} from '../validators/class.validators.js';

/** Rotas de turmas (Etapa 20). Todas exigem sessao ativa. */
export const classRoutes: Router = Router();

classRoutes.use(authenticate);

// --- Convites: por token, sem exigir ser membro ainda ---------------------------
// Precisam vir ANTES de `/classes/:id` para "invites" nao ser lido como um id.

classRoutes.get(
  '/classes/invites/:token',
  validate({ params: classInviteTokenParamSchema }),
  classController.previewInvite,
);

classRoutes.post(
  '/classes/invites/:token/join',
  classJoinRateLimiter,
  validate({ params: classInviteTokenParamSchema }),
  classController.join,
);

// --- Turma -----------------------------------------------------------------------

classRoutes.get('/classes', classController.list);

classRoutes.post('/classes', validate({ body: createClassSchema }), classController.create);

classRoutes.get(
  '/classes/:id',
  validate({ params: classIdParamSchema }),
  classGuard,
  classController.getById,
);

classRoutes.patch(
  '/classes/:id',
  validate({ params: classIdParamSchema, body: updateClassSchema }),
  classGuard,
  classController.update,
);

classRoutes.get(
  '/classes/:id/members',
  validate({ params: classIdParamSchema }),
  classGuard,
  classController.listMembers,
);

classRoutes.post(
  '/classes/:id/leave',
  validate({ params: classIdParamSchema }),
  classGuard,
  classController.leave,
);

// --- Propriedade, arquivamento e saúde (Etapa 24) -------------------------------------

classRoutes.post(
  '/classes/:id/transfer-owner',
  validate({ params: classIdParamSchema, body: transferClassOwnerSchema }),
  classGuard,
  classController.transferOwner,
);

classRoutes.post(
  '/classes/:id/archive',
  validate({ params: classIdParamSchema }),
  classGuard,
  classController.archive,
);

classRoutes.post(
  '/classes/:id/unarchive',
  validate({ params: classIdParamSchema }),
  classGuard,
  classController.unarchive,
);

classRoutes.get(
  '/classes/:id/health',
  validate({ params: classIdParamSchema }),
  classGuard,
  classController.health,
);

// --- Finalizar semestre (Etapa 30.5) --------------------------------------------

classRoutes.get(
  '/classes/:id/finish-semester-preview',
  validate({ params: classIdParamSchema }),
  classGuard,
  classController.finishSemesterPreview,
);

classRoutes.post(
  '/classes/:id/finish-semester',
  validate({ params: classIdParamSchema }),
  classGuard,
  classController.finishSemester,
);

classRoutes.get(
  '/classes/:id/history',
  validate({ params: classIdParamSchema }),
  classGuard,
  classController.getHistory,
);

// --- Disciplinas-molde -------------------------------------------------------------

classRoutes.post(
  '/classes/:id/subjects',
  validate({ params: classIdParamSchema, body: classSubjectInputSchema }),
  classGuard,
  classController.addSubject,
);

classRoutes.patch(
  '/classes/:id/subjects/:subjectId',
  validate({ params: classSubjectIdParamSchema, body: updateClassSubjectSchema }),
  classGuard,
  classController.updateSubject,
);

classRoutes.delete(
  '/classes/:id/subjects/:subjectId',
  validate({ params: classSubjectIdParamSchema }),
  classGuard,
  classController.removeSubject,
);

// --- Convites (gestao pelo dono) ----------------------------------------------------

classRoutes.get(
  '/classes/:id/invites',
  validate({ params: classIdParamSchema }),
  classGuard,
  classController.listInvites,
);

classRoutes.post(
  '/classes/:id/invites',
  validate({ params: classIdParamSchema, body: createClassInviteSchema }),
  classGuard,
  classController.createInvite,
);

classRoutes.delete(
  '/classes/:id/invites/:inviteId',
  validate({ params: classInviteIdParamSchema }),
  classGuard,
  classController.revokeInvite,
);

// --- Publicações (Etapa 21) ---------------------------------------------------------
// "upcoming" precisa vir antes de "/:postId" - senão o Express leria "upcoming"
// como um id de post.

classRoutes.get(
  '/classes/:id/posts',
  validate({ params: classIdParamSchema }),
  classGuard,
  classPostController.list,
);

classRoutes.post(
  '/classes/:id/posts',
  validate({ params: classIdParamSchema, body: createClassPostSchema }),
  classGuard,
  classPostController.publish,
);

classRoutes.get(
  '/classes/:id/posts/upcoming',
  validate({ params: classIdParamSchema, query: upcomingClassPostsQuerySchema }),
  classGuard,
  classPostController.upcoming,
);

classRoutes.get(
  '/classes/:id/posts/:postId',
  validate({ params: classPostIdParamSchema }),
  classGuard,
  classPostController.getById,
);

classRoutes.patch(
  '/classes/:id/posts/:postId',
  validate({ params: classPostIdParamSchema, body: updateClassPostSchema }),
  classGuard,
  classPostController.update,
);

classRoutes.delete(
  '/classes/:id/posts/:postId',
  validate({ params: classPostIdParamSchema }),
  classGuard,
  classPostController.remove,
);

// --- Mural: avisos (Etapa 22) --------------------------------------------------------

classRoutes.get(
  '/classes/:id/announcements',
  validate({ params: classIdParamSchema }),
  classGuard,
  classAnnouncementController.list,
);

classRoutes.post(
  '/classes/:id/announcements',
  validate({ params: classIdParamSchema, body: createClassAnnouncementSchema }),
  classGuard,
  classAnnouncementController.create,
);

classRoutes.patch(
  '/classes/:id/announcements/:announcementId',
  validate({ params: classAnnouncementIdParamSchema, body: updateClassAnnouncementSchema }),
  classGuard,
  classAnnouncementController.update,
);

classRoutes.delete(
  '/classes/:id/announcements/:announcementId',
  validate({ params: classAnnouncementIdParamSchema }),
  classGuard,
  classAnnouncementController.remove,
);

// --- Mural: anotações (Etapa 22) ------------------------------------------------------

classRoutes.get(
  '/classes/:id/notes',
  validate({ params: classIdParamSchema }),
  classGuard,
  classNoteController.list,
);

classRoutes.post(
  '/classes/:id/notes',
  validate({ params: classIdParamSchema, body: createClassNoteSchema }),
  classGuard,
  classNoteController.create,
);

classRoutes.get(
  '/classes/:id/notes/:noteId',
  validate({ params: classNoteIdParamSchema }),
  classGuard,
  classNoteController.getById,
);

classRoutes.patch(
  '/classes/:id/notes/:noteId',
  validate({ params: classNoteIdParamSchema, body: updateClassNoteSchema }),
  classGuard,
  classNoteController.update,
);

classRoutes.delete(
  '/classes/:id/notes/:noteId',
  validate({ params: classNoteIdParamSchema }),
  classGuard,
  classNoteController.remove,
);

// --- Materiais (Etapa 23) --------------------------------------------------------------
// "upload", "link" e "summary" precisam vir ANTES de "/:materialId" - senão o
// Express leria esses segmentos como um id de material.

classRoutes.get(
  '/classes/:id/materials',
  validate({ params: classIdParamSchema }),
  classGuard,
  classMaterialController.list,
);

classRoutes.get(
  '/classes/:id/materials/summary',
  validate({ params: classIdParamSchema }),
  classGuard,
  classMaterialController.summary,
);

/** O multer precisa rodar ANTES do validate - os campos de texto do multipart só existem depois. */
classRoutes.post(
  '/classes/:id/materials/upload',
  validate({ params: classIdParamSchema }),
  classGuard,
  uploadSingleFile,
  validate({ body: uploadClassMaterialSchema }),
  classMaterialController.upload,
);

classRoutes.post(
  '/classes/:id/materials/link',
  validate({ params: classIdParamSchema, body: createClassMaterialLinkSchema }),
  classGuard,
  classMaterialController.createLink,
);

classRoutes.get(
  '/classes/:id/materials/:materialId/download',
  validate({ params: classMaterialIdParamSchema }),
  classGuard,
  classMaterialController.download,
);

classRoutes.delete(
  '/classes/:id/materials/:materialId',
  validate({ params: classMaterialIdParamSchema }),
  classGuard,
  classMaterialController.remove,
);
