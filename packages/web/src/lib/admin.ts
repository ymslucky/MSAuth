/** 管理端 OAuth 客户端 API + 查询键（全部要求 admin 角色，非 admin 由 API 返回 403） */
import type { ClientCreateInput, ClientSecretCreated, ClientUpdateInput, OAuthClient } from '@msauth/shared';
import { api } from './api';

export const adminClientsKey = ['admin-clients'] as const;

export const listClients = () => api.get<{ clients: OAuthClient[] }>('/api/admin/clients');

/** confidential 响应额外带一次性 clientSecret；public 只有 { client } */
export const createClient = (input: ClientCreateInput) =>
  api.post<{ client: OAuthClient; clientSecret?: string }>('/api/admin/clients', input);

export const updateClient = (id: string, input: ClientUpdateInput) =>
  api.patch<{ client: OAuthClient }>(`/api/admin/clients/${id}`, input);

export const rotateClientSecret = (id: string) =>
  api.post<ClientSecretCreated>(`/api/admin/clients/${id}/rotate-secret`);

export const deleteClient = (id: string) => api.del<void>(`/api/admin/clients/${id}`);
