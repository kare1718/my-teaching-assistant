import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';

export function useMyScores(studentId) {
  const url = studentId ? `/scores/my-scores?studentId=${studentId}` : '/scores/my-scores';
  return useQuery({
    queryKey: ['scores', 'my-scores', studentId || ''],
    queryFn: () => api(url),
    staleTime: 2 * 60_000,
  });
}

export function useStudentsList(enabled) {
  return useQuery({
    queryKey: ['scores', 'students-list'],
    queryFn: () => api('/scores/students-list'),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useDistribution(examId) {
  return useQuery({
    queryKey: ['scores', 'distribution', examId],
    queryFn: () => api(`/scores/exams/${examId}/distribution`),
    enabled: !!examId,
    staleTime: 5 * 60_000,
  });
}

export function useOmrSubmission(examId, studentId) {
  const url = studentId
    ? `/scores/exams/${examId}/my-submission?studentId=${studentId}`
    : `/scores/exams/${examId}/my-submission`;
  return useQuery({
    queryKey: ['scores', 'omr', examId, studentId || ''],
    queryFn: () => api(url),
    enabled: !!examId,
    staleTime: 5 * 60_000,
  });
}
