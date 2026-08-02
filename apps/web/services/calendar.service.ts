import type {
  CalendarEventDetail,
  CalendarItem,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from '@painel/shared';
import { httpClient } from './http-client';

export const calendarService = {
  /** Itens da agenda no intervalo. As datas vão como ISO absoluto. */
  agenda(from: Date, to: Date, includeCompleted: boolean): Promise<CalendarItem[]> {
    return httpClient.get<CalendarItem[]>('/calendar', {
      query: {
        from: from.toISOString(),
        to: to.toISOString(),
        includeCompleted: String(includeCompleted),
      },
    });
  },

  createEvent(data: CreateCalendarEventInput): Promise<CalendarEventDetail> {
    return httpClient.post<CalendarEventDetail>('/calendar/events', data);
  },

  getEvent(id: string): Promise<CalendarEventDetail> {
    return httpClient.get<CalendarEventDetail>(`/calendar/events/${id}`);
  },

  updateEvent(id: string, data: UpdateCalendarEventInput): Promise<CalendarEventDetail> {
    return httpClient.patch<CalendarEventDetail>(`/calendar/events/${id}`, data);
  },

  removeEvent(id: string): Promise<void> {
    return httpClient.delete<void>(`/calendar/events/${id}`);
  },
};
