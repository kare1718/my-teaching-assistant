import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';

export function useStudentDashboard() {
  return useQuery({
    queryKey: ['student', 'dashboard'],
    queryFn: () => api('/students/dashboard'),
    staleTime: 2 * 60_000,
  });
}
