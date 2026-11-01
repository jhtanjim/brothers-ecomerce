import { apiFetch, apiFetchPage } from './client';

export interface Member {
  id: string;
  number: number;
  name: string;
  phone: string;
  active: boolean;
  createdAt: string;
}

export interface MemberRow extends Member {
  purchaseCount: number;
  totalSpent: string;
}

export function memberCode(number: number): string {
  return `M-${String(number).padStart(4, '0')}`;
}

export function getMembers(search: string, page: number) {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) params.set('search', search);
  return apiFetchPage<MemberRow>(`/admin/members?${params.toString()}`);
}

export function createMember(input: { name: string; phone: string }): Promise<Member> {
  return apiFetch<Member>('/admin/members', { method: 'POST', body: JSON.stringify(input) });
}

export function setMemberActive(id: string, active: boolean): Promise<Member> {
  return apiFetch<Member>(`/admin/members/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
}
