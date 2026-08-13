import type {
  ClassDetail,
  ClassHealthSummary,
  ClassInviteCreated,
  ClassInviteItem,
  ClassInvitePreview,
  ClassMemberItem,
  ClassSubjectInput,
  ClassSubjectItem,
  ClassSummary,
  CreateClassInput,
  CreateClassInviteInput,
  JoinClassResult,
  TransferClassOwnerInput,
  UpdateClassInput,
} from '@painel/shared';
import { httpClient } from './http-client';

export const classService = {
  list(): Promise<ClassSummary[]> {
    return httpClient.get<ClassSummary[]>('/classes');
  },

  getById(id: string): Promise<ClassDetail> {
    return httpClient.get<ClassDetail>(`/classes/${id}`);
  },

  create(data: CreateClassInput): Promise<ClassDetail> {
    return httpClient.post<ClassDetail>('/classes', data);
  },

  update(id: string, data: UpdateClassInput): Promise<ClassDetail> {
    return httpClient.patch<ClassDetail>(`/classes/${id}`, data);
  },

  listMembers(id: string): Promise<ClassMemberItem[]> {
    return httpClient.get<ClassMemberItem[]>(`/classes/${id}/members`);
  },

  leave(id: string): Promise<void> {
    return httpClient.post<void>(`/classes/${id}/leave`);
  },

  addSubject(id: string, data: ClassSubjectInput): Promise<ClassSubjectItem> {
    return httpClient.post<ClassSubjectItem>(`/classes/${id}/subjects`, data);
  },

  updateSubject(
    id: string,
    subjectId: string,
    data: Partial<ClassSubjectInput>,
  ): Promise<ClassSubjectItem> {
    return httpClient.patch<ClassSubjectItem>(`/classes/${id}/subjects/${subjectId}`, data);
  },

  removeSubject(id: string, subjectId: string): Promise<void> {
    return httpClient.delete<void>(`/classes/${id}/subjects/${subjectId}`);
  },

  listInvites(id: string): Promise<ClassInviteItem[]> {
    return httpClient.get<ClassInviteItem[]>(`/classes/${id}/invites`);
  },

  createInvite(id: string, data: CreateClassInviteInput): Promise<ClassInviteCreated> {
    return httpClient.post<ClassInviteCreated>(`/classes/${id}/invites`, data);
  },

  revokeInvite(id: string, inviteId: string): Promise<void> {
    return httpClient.delete<void>(`/classes/${id}/invites/${inviteId}`);
  },

  previewInvite(token: string): Promise<ClassInvitePreview> {
    return httpClient.get<ClassInvitePreview>(`/classes/invites/${token}`);
  },

  join(token: string): Promise<JoinClassResult> {
    return httpClient.post<JoinClassResult>(`/classes/invites/${token}/join`);
  },

  transferOwner(id: string, data: TransferClassOwnerInput): Promise<void> {
    return httpClient.post<void>(`/classes/${id}/transfer-owner`, data);
  },

  archive(id: string): Promise<void> {
    return httpClient.post<void>(`/classes/${id}/archive`);
  },

  unarchive(id: string): Promise<void> {
    return httpClient.post<void>(`/classes/${id}/unarchive`);
  },

  health(id: string): Promise<ClassHealthSummary> {
    return httpClient.get<ClassHealthSummary>(`/classes/${id}/health`);
  },
};
