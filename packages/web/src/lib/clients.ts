/** OAuth 客户端自助管理 API + 查询键（归属权模型：任意登录用户管理自己创建的应用，他人 → 404） */
import type { ClientCreateInput, ClientSecretCreated, ClientUpdateInput, OAuthClient } from '@msauth/shared';
import { api } from './api';

export const clientsKey = ['clients'] as const;

export const listClients = () => api.get<{ clients: OAuthClient[] }>('/api/account/clients');

/** confidential 响应额外带一次性 clientSecret；public 只有 { client } */
export const createClient = (input: ClientCreateInput) =>
  api.post<{ client: OAuthClient; clientSecret?: string }>('/api/account/clients', input);

export const updateClient = (id: string, input: ClientUpdateInput) =>
  api.patch<{ client: OAuthClient }>(`/api/account/clients/${id}`, input);

export const rotateClientSecret = (id: string) =>
  api.post<ClientSecretCreated>(`/api/account/clients/${id}/rotate-secret`);

export const deleteClient = (id: string) => api.del<void>(`/api/account/clients/${id}`);
