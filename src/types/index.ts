export interface User {
  id: string;
  studentId: string;
  name: string;
  email: string;
  onboardingComplete: boolean;
}

export type Campus = 'Rabat' | 'Ben Guerir' | 'Cross-campus';
export type HomeCampus = 'Rabat' | 'Ben Guerir';
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface AvailabilityBlock {
  id?: string;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
  activityName?: string | null;
}
export interface StudentProfile {
  studentId: string;
  fullName: string;
  homeCampus: HomeCampus | null;
  school: string;
  interests: string[];
  unavailableBlocks: AvailabilityBlock[];
  onboardingComplete: boolean;
}
export type ProfileUpdate = Omit<StudentProfile, 'studentId' | 'onboardingComplete'>;

export interface CampusEvent {
  id: string;
  title: string;
  summary: string;
  startAt?: string;
  endAt?: string;
  timezone?: string;
  campus: Campus;
  category: string;
  relevanceScore?: number;
  statuses: Array<'relevant' | 'cross-campus' | 'conflict'>;
  sourceName?: string;
  sourceUrl?: string;
  actionUrl?: string;
  calendarUrl?: string;
  isDemo?: boolean;
}

export interface ChatSource { title: string; url?: string; publishedAt?: string }
export interface ChatAttachment { name: string; mimeType: string; size: number; url?: string }
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  attachments?: ChatAttachment[];
  sources?: ChatSource[];
  isDemo?: boolean;
}
export interface ChatResponse { conversationId: string; message: string; sources?: ChatSource[]; attachments?: ChatAttachment[]; demo?: boolean }
export interface ApiErrorShape { message: string; code?: string; fieldErrors?: Record<string, string> }
