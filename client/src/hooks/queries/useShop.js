import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiPost } from '../../api';

export function useShopItems() {
  return useQuery({
    queryKey: ['shop', 'items'],
    queryFn: () => api('/gamification/shop/items'),
    staleTime: 2 * 60_000,
  });
}

export function useMyPurchases() {
  return useQuery({
    queryKey: ['shop', 'my-purchases'],
    queryFn: () => api('/gamification/shop/my-purchases'),
    staleTime: 2 * 60_000,
  });
}

export function useShopCharacter() {
  return useQuery({
    queryKey: ['gamification', 'my-character'],
    queryFn: () => api('/gamification/my-character'),
    staleTime: 2 * 60_000,
  });
}

export function usePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId) => apiPost('/gamification/shop/purchase', { itemId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop'] });
      queryClient.invalidateQueries({ queryKey: ['gamification', 'my-character'] });
    },
  });
}
