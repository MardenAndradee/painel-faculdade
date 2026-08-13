import type { AttachmentSource, AttachmentType } from '@painel/shared';
import { prisma, type Prisma } from '../config/prisma.js';

/** Acesso a dados de materiais da turma (Etapa 23). */

const listSelect = {
  id: true,
  name: true,
  type: true,
  source: true,
  url: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true } },
} satisfies Prisma.ClassMaterialSelect;

export type ClassMaterialListRow = Prisma.ClassMaterialGetPayload<{ select: typeof listSelect }>;

/** Dados necessarios para servir ou apagar o blob, mais quem enviou (regra de exclusao). */
const storageSelect = {
  id: true,
  name: true,
  storageKey: true,
  mimeType: true,
  sizeBytes: true,
  uploadedById: true,
} satisfies Prisma.ClassMaterialSelect;

export type ClassMaterialStorageRow = Prisma.ClassMaterialGetPayload<{
  select: typeof storageSelect;
}>;

export const classMaterialRepository = {
  listByClass(classId: string): Promise<ClassMaterialListRow[]> {
    return prisma.classMaterial.findMany({
      where: { classId },
      select: listSelect,
      orderBy: { createdAt: 'desc' },
    });
  },

  findForStorage(classId: string, id: string): Promise<ClassMaterialStorageRow | null> {
    return prisma.classMaterial.findFirst({ where: { id, classId }, select: storageSelect });
  },

  create(
    classId: string,
    uploadedById: string,
    data: {
      id?: string;
      name: string;
      type: AttachmentType;
      source: AttachmentSource;
      url: string;
      storageKey: string | null;
      mimeType: string | null;
      sizeBytes: number | null;
    },
  ): Promise<ClassMaterialListRow> {
    return prisma.classMaterial.create({
      data: { ...data, classId, uploadedById },
      select: listSelect,
    });
  },

  async delete(classId: string, id: string): Promise<boolean> {
    const result = await prisma.classMaterial.deleteMany({ where: { id, classId } });

    return result.count > 0;
  },

  /** Resumo do acervo DA TURMA - agregado por `classId`, nunca por quem enviou. */
  async summarize(
    classId: string,
  ): Promise<{ totalBytes: number; totalFiles: number; totalLinks: number }> {
    const [aggregate, totalFiles, totalLinks] = await prisma.$transaction([
      prisma.classMaterial.aggregate({ where: { classId }, _sum: { sizeBytes: true } }),
      prisma.classMaterial.count({ where: { classId, storageKey: { not: null } } }),
      prisma.classMaterial.count({ where: { classId, storageKey: null } }),
    ]);

    return {
      totalBytes: aggregate._sum.sizeBytes ?? 0,
      totalFiles,
      totalLinks,
    };
  },
};
