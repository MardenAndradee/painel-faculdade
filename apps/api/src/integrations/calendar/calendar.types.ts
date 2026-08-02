/**
 * Tipos da API do Google Calendar.
 *
 * Declarados a mao, pelo mesmo motivo do Classroom: o pacote `googleapis`
 * traria os tipos de todas as APIs do Google para consumirmos um endpoint.
 * Referencia: https://developers.google.com/calendar/api/v3/reference/events
 */

/**
 * Data/hora de um evento.
 *
 * O Google usa campos diferentes conforme o tipo: `dateTime` (com fuso) para
 * eventos com horario, `date` (YYYY-MM-DD) para eventos de dia inteiro.
 */
export interface GoogleEventDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  htmlLink?: string;
  /** Id da serie, presente nas instancias de um evento recorrente. */
  recurringEventId?: string;
  updated?: string;
  /** Marca eventos que o usuario apenas visualiza, sem ser participante. */
  transparency?: 'opaque' | 'transparent';
}

/** Contrato consumido pelo servico de sincronizacao. */
export interface GoogleCalendarClient {
  listEvents(from: Date, to: Date): Promise<GoogleCalendarEvent[]>;
}
