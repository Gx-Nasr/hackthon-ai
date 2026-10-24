import { apiRequest } from '../lib/api';
import type { ProfileUpdate, StudentProfile } from '../types';

export const profileService = {
  async get(): Promise<StudentProfile> {
    return (await apiRequest<{ profile: StudentProfile }>('/api/profile')).profile;
  },
  async save(profile: ProfileUpdate): Promise<StudentProfile> {
    const payload = { ...profile, unavailableBlocks: profile.unavailableBlocks.map(({ dayOfWeek, startTime, endTime, activityName }) => ({ dayOfWeek, startTime, endTime, activityName: activityName || null })) };
    return (await apiRequest<{ profile: StudentProfile }>('/api/profile', { method: 'PUT', body: JSON.stringify(payload) })).profile;
  },
};
