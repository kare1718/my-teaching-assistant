import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiPost, apiPut } from '../../api';

export function useMyScores(studentId) {
  const url = studentId ? `/scores/my-scores?studentId=${studentId}` : '/scores/my-scores';
  return useQuery({
    queryKey: ['scores', 'my-scores', studentId || ''],
    queryFn: () => api(url),
    staleTime: 30_000,
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
    staleTime: 10_000,
  });
}

export function useStudentOmrExams(studentId) {
  const url = studentId
    ? `/scores/student/omr-exams?studentId=${studentId}`
    : '/scores/student/omr-exams';
  return useQuery({
    queryKey: ['scores', 'student-omr-exams', studentId || ''],
    queryFn: () => api(url),
    staleTime: 15_000,
  });
}

export function useStartOmr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (examId) => apiPost(`/scores/exams/${examId}/start-omr`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scores', 'student-omr-exams'] });
    },
  });
}

export function useSaveOmrDraft() {
  return useMutation({
    mutationFn: ({ examId, answers }) => apiPut(`/scores/exams/${examId}/draft-answers`, { answers }),
  });
}

export function useSubmitOmrAnswers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, answers, autoSubmittedByTimer }) =>
      apiPost(`/scores/exams/${examId}/submit-answers`, { answers, autoSubmittedByTimer }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scores', 'student-omr-exams'] });
      queryClient.invalidateQueries({ queryKey: ['scores', 'my-scores'] });
      queryClient.invalidateQueries({ queryKey: ['scores', 'omr', variables.examId] });
    },
  });
}

export function useFinalizeOmrSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (examId) => apiPost(`/scores/exams/${examId}/finalize-submission`, {}),
    onSuccess: (_, examId) => {
      queryClient.invalidateQueries({ queryKey: ['scores', 'student-omr-exams'] });
      queryClient.invalidateQueries({ queryKey: ['scores', 'my-scores'] });
      queryClient.invalidateQueries({ queryKey: ['scores', 'omr', examId] });
    },
  });
}

