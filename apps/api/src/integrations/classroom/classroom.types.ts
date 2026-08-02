/**
 * Tipos da API do Google Classroom.
 *
 * Declarados a mao em vez de instalar `googleapis`: o pacote traz os tipos de
 * TODAS as APIs do Google (dezenas de MB) para usarmos tres endpoints.
 * Referencia: https://developers.google.com/classroom/reference/rest
 */

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  room?: string;
  ownerId?: string;
  courseState?: 'ACTIVE' | 'ARCHIVED' | 'PROVISIONED' | 'DECLINED' | 'SUSPENDED';
  alternateLink?: string;
}

export interface ClassroomTeacherProfile {
  id: string;
  name?: { fullName?: string; givenName?: string; familyName?: string };
  emailAddress?: string;
}

export interface ClassroomTeacher {
  courseId: string;
  userId: string;
  profile?: ClassroomTeacherProfile;
}

/** Data sem fuso, como o Classroom devolve. */
export interface ClassroomDate {
  year?: number;
  month?: number;
  day?: number;
}

export interface ClassroomTimeOfDay {
  hours?: number;
  minutes?: number;
  seconds?: number;
}

export interface ClassroomMaterial {
  driveFile?: {
    driveFile?: { id?: string; title?: string; alternateLink?: string; thumbnailUrl?: string };
  };
  youtubeVideo?: { id?: string; title?: string; alternateLink?: string };
  link?: { url?: string; title?: string };
  form?: { formUrl?: string; title?: string };
}

export interface ClassroomCourseWork {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  materials?: ClassroomMaterial[];
  state?: 'PUBLISHED' | 'DRAFT' | 'DELETED';
  alternateLink?: string;
  dueDate?: ClassroomDate;
  dueTime?: ClassroomTimeOfDay;
  maxPoints?: number;
  workType?: 'ASSIGNMENT' | 'SHORT_ANSWER_QUESTION' | 'MULTIPLE_CHOICE_QUESTION';
  updateTime?: string;
}

/** Entrega do proprio aluno, usada para saber o que ja foi entregue. */
export interface ClassroomSubmission {
  id: string;
  courseId: string;
  courseWorkId: string;
  state?: 'NEW' | 'CREATED' | 'TURNED_IN' | 'RETURNED' | 'RECLAIMED_BY_STUDENT';
  late?: boolean;
  assignedGrade?: number;
}

/** Contrato que o servico de sincronizacao consome. */
export interface ClassroomClient {
  listCourses(): Promise<ClassroomCourse[]>;
  listTeachers(courseId: string): Promise<ClassroomTeacher[]>;
  listCourseWork(courseId: string): Promise<ClassroomCourseWork[]>;
  listSubmissions(courseId: string): Promise<ClassroomSubmission[]>;
}
