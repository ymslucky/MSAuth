/**
 * OAuth 应用管理（SPEC §7.11，Phase 2b 基础版）：归属权模型——任意登录用户
 * 管理自己创建的下游应用（谁创建谁管理，他人应用 API 侧 404）。
 * 列表（白卡行）+ 注册/编辑/轮换/删除四类弹层；confidential 的 secret 仅一次性展示。
 * 校验直接复用 shared 的 clientCreateSchema / clientUpdateSchema（单一事实源）。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppWindow, Check, Copy, Plus, X } from 'lucide-react';
import {
  CLIENT_TYPES,
  SCOPE_LABELS,
  SCOPE_LIST,
  TTL_LIMITS,
  clientCreateSchema,
  clientUpdateSchema,
  type ClientCreateInput,
  type ClientType,
  type ClientUpdateInput,
  type OAuthClient,
} from '@msauth/shared';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { EmptyState } from '../../components/ui/empty-state';
import { Field } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { useToast } from '../../components/ui/toast';
import { useCsrfWarmup } from '../../hooks/use-csrf';
import { useSession } from '../../hooks/use-session';
import {
  clientsKey,
  createClient,
  deleteClient,
  listClients,
  rotateClientSecret,
  updateClient,
} from '../../lib/clients';
import { fmtDateTime } from '../../lib/format';

type FormTarget = { mode: 'create' } | { mode: 'edit'; client: OAuthClient };

/** 秒 → 紧凑时长（15m / 7d / 90s），列表行展示用 */
function fmtTtl(seconds: number): string {
  if (seconds % 86_400 === 0) return `${seconds / 86_400}d`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

/** 复制按钮：成功变 ✓ + toast（同账户概览页模式） */
function CopyButton({ value, className = '' }: { value: string; className?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="复制"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success('已复制');
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error('复制失败', '浏览器未授权剪贴板访问');
        }
      }}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${className || 'text-ink-4 hover:text-action'}`}
    >
      {copied ? (
        <Check size={14} strokeWidth={2.5} className="text-success" aria-hidden="true" />
      ) : (
        <Copy size={14} aria-hidden="true" />
      )}
    </button>
  );
}

/** 内容型弹层：视觉与确认 Dialog 同源（card-modal + anim-pop），承载表单/secret 展示 */
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  // Esc 关闭 + 正文滚动锁定（同确认 Dialog）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/30 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="anim-pop card-modal flex max-h-[calc(100dvh-48px)] w-full max-w-[520px] flex-col rounded-dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-5">
          <h2 className="t-title">{title}</h2>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="rounded-md p-1 text-ink-4 transition-colors hover:text-ink"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/** 一次性 clientSecret 展示：mono 大字段 + 复制 + 警示「仅显示一次」，关闭后刷新列表 */
function SecretDialog({ secret, onClose }: { secret: string; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="client_secret 已生成">
      <p className="t-caption">机密客户端的 secret 仅此一次可见，请立即复制并妥善保存（服务端只存哈希，丢失后只能重新轮换）。</p>
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface-input px-4 py-3">
        <code className="min-w-0 flex-1 font-mono text-[13px] leading-6 break-all text-ink">{secret}</code>
        <CopyButton value={secret} />
      </div>
      <p className="t-caption mt-3 text-warning">仅显示一次：关闭后无法再查看。</p>
      <div className="mt-6 flex justify-end">
        <Button variant="primary" onClick={onClose}>
          我已保存
        </Button>
      </div>
    </Modal>
  );
}

/** 表单原值（redirect_uris 为 textarea 每行一个；TTL 留空 = 不传/保持原值） */
interface ClientFormState {
  name: string;
  clientType: ClientType;
  redirectUris: string;
  allowedScopes: string[];
  resource: string;
  accessTokenTtl: string;
  refreshTokenTtl: string;
}

function emptyForm(): ClientFormState {
  return {
    name: '',
    clientType: 'public',
    redirectUris: '',
    allowedScopes: ['profile:read'],
    resource: '',
    accessTokenTtl: '',
    refreshTokenTtl: '',
  };
}

function prefillForm(c: OAuthClient): ClientFormState {
  return {
    name: c.name,
    clientType: c.clientType,
    redirectUris: c.redirectUris.join('\n'),
    allowedScopes: [...c.allowedScopes],
    resource: c.resource,
    accessTokenTtl: String(c.accessTokenTtlSeconds),
    refreshTokenTtl: String(c.refreshTokenTtlSeconds),
  };
}

const CLIENT_TYPE_OPTIONS: Record<ClientType, string> = {
  public: '公共 public · 浏览器/移动端，无 secret，靠 PKCE',
  confidential: '机密 confidential · 服务端应用，持有 client_secret',
};

/** 组装 wire 体：编辑不带 clientType（不可改）；TTL 留空则不传 */
function composeBody(state: ClientFormState, isEdit: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: state.name,
    redirect_uris: state.redirectUris.split('\n').map((line) => line.trim()).filter(Boolean),
    allowed_scopes: state.allowedScopes,
    resource: state.resource,
  };
  if (!isEdit) body.clientType = state.clientType;
  const at = state.accessTokenTtl.trim();
  const rt = state.refreshTokenTtl.trim();
  if (at) body.access_token_ttl_seconds = Number(at);
  if (rt) body.refresh_token_ttl_seconds = Number(rt);
  return body;
}

/** 注册 / 编辑弹层：client 为 null 即创建模式；客户端校验复用 shared schema */
function ClientFormDialog({
  client,
  pending,
  onClose,
  onSubmit,
}: {
  client: OAuthClient | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: ClientCreateInput | ClientUpdateInput) => void;
}) {
  const isEdit = client !== null;
  const [state, setState] = useState<ClientFormState>(() => (client ? prefillForm(client) : emptyForm()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const selectId = useId();
  const urisId = useId();

  const toggleScope = (scope: string) => {
    setState((s) => ({
      ...s,
      allowedScopes: s.allowedScopes.includes(scope)
        ? s.allowedScopes.filter((x) => x !== scope)
        : [...s.allowedScopes, scope],
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const schema = isEdit ? clientUpdateSchema : clientCreateSchema;
    const parsed = schema.safeParse(composeBody(state, isEdit));
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      let top = '';
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (!key) top = issue.message;
        else if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setFormError(top);
      return;
    }
    setErrors({});
    setFormError('');
    onSubmit(parsed.data);
  };

  const inputClass =
    'h-11 w-full rounded-xl border border-line bg-surface-input px-3.5 text-sm text-ink transition-[border-color,box-shadow] duration-150 hover:border-ink-4/60 focus:border-action focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-action)_15%,transparent)]';

  return (
    <Modal open onClose={onClose} title={isEdit ? `编辑应用 · ${client.name}` : '注册应用'}>
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <Field
          label="名称"
          placeholder="如 mstor-web"
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
          error={errors.name}
          autoFocus
        />

        {/* 类型仅创建时可选：公共↔机密涉及 secret 语义，创建后不可改 */}
        {!isEdit && (
          <div className="space-y-1.5">
            <label htmlFor={selectId} className="overline block">
              类型
            </label>
            <select
              id={selectId}
              value={state.clientType}
              onChange={(e) => setState((s) => ({ ...s, clientType: e.target.value as ClientType }))}
              className={inputClass}
            >
              {CLIENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CLIENT_TYPE_OPTIONS[t]}
                </option>
              ))}
            </select>
            <p className="t-caption">创建后不可更改；如需切换类型请删除后重新注册</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor={urisId} className="overline block">
            回调地址（redirect_uris）
          </label>
          <textarea
            id={urisId}
            rows={3}
            value={state.redirectUris}
            onChange={(e) => setState((s) => ({ ...s, redirectUris: e.target.value }))}
            placeholder={'https://app.example.com/callback'}
            className={`${inputClass} min-h-[88px] py-2.5 font-mono text-[13px] leading-6`}
          />
          {errors.redirect_uris ? (
            <p className="t-caption text-danger">{errors.redirect_uris}</p>
          ) : (
            <p className="t-caption">每行一个绝对 http(s) URL，最多 8 个；授权时精确匹配</p>
          )}
        </div>

        <fieldset className="space-y-1.5">
          <legend className="overline block">允许的 scope</legend>
          <div className="flex flex-wrap gap-2">
            {SCOPE_LIST.map((scope) => {
              const checked = state.allowedScopes.includes(scope);
              return (
                <label
                  key={scope}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                    checked
                      ? 'border-action/30 bg-action-subtle text-action-hover'
                      : 'border-line bg-canvas text-ink-3 hover:border-ink-4/60'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-action"
                    checked={checked}
                    onChange={() => toggleScope(scope)}
                  />
                  {SCOPE_LABELS[scope]}
                </label>
              );
            })}
          </div>
          {errors.allowed_scopes && <p className="t-caption text-danger">{errors.allowed_scopes}</p>}
        </fieldset>

        <Field
          label="resource（令牌受众）"
          placeholder="https://mstor.example.com"
          value={state.resource}
          onChange={(e) => setState((s) => ({ ...s, resource: e.target.value }))}
          error={errors.resource}
          hint="访问令牌的 aud，绝对 http(s) URL，不能指向 MSAuth 自身"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="访问令牌 TTL（秒）"
            inputMode="numeric"
            placeholder={isEdit ? '保持不变' : '默认 900（15 分钟）'}
            value={state.accessTokenTtl}
            onChange={(e) => setState((s) => ({ ...s, accessTokenTtl: e.target.value }))}
            error={errors.access_token_ttl_seconds}
            hint={`可选 · ${TTL_LIMITS.accessToken.min}–${TTL_LIMITS.accessToken.max}`}
          />
          <Field
            label="刷新令牌 TTL（秒）"
            inputMode="numeric"
            placeholder={isEdit ? '保持不变' : '默认 604800（7 天）'}
            value={state.refreshTokenTtl}
            onChange={(e) => setState((s) => ({ ...s, refreshTokenTtl: e.target.value }))}
            error={errors.refresh_token_ttl_seconds}
            hint={`可选 · ${TTL_LIMITS.refreshToken.min}–${TTL_LIMITS.refreshToken.max}`}
          />
        </div>

        {formError && (
          <p role="alert" className="t-caption text-danger">
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="secondary" type="button" onClick={onClose} disabled={pending}>
            取消
          </Button>
          <Button type="submit" loading={pending}>
            {isEdit ? '保存修改' : '注册应用'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ClientsPage() {
  useCsrfWarmup();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useSession();

  const query = useQuery({ queryKey: clientsKey, queryFn: listClients });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: clientsKey });
  const onError = (err: Error) => toast.error('操作失败', err.message);

  const [form, setForm] = useState<FormTarget | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [rotating, setRotating] = useState<OAuthClient | null>(null);
  const [deleting, setDeleting] = useState<OAuthClient | null>(null);

  // 创建：confidential 成功后先关表单、弹一次性 secret，关闭 secret 时再刷新列表
  const createMutation = useMutation({
    mutationFn: (input: ClientCreateInput) => createClient(input),
    onSuccess: ({ client, clientSecret }) => {
      toast.success('应用已注册', client.name);
      setForm(null);
      if (clientSecret) setSecret(clientSecret);
      else void invalidate();
    },
    onError,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ClientUpdateInput }) => updateClient(id, input),
    onSuccess: ({ client }) => {
      toast.success('应用已更新', client.name);
      setForm(null);
      void invalidate();
    },
    onError,
  });
  const rotateMutation = useMutation({
    mutationFn: (id: string) => rotateClientSecret(id),
    onSuccess: ({ clientSecret }) => {
      setRotating(null);
      setSecret(clientSecret);
    },
    onError,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      toast.success('应用已删除');
      setDeleting(null);
      void invalidate();
    },
    onError,
  });

  if (!user) return null;

  const clients = query.data?.clients ?? [];

  return (
    <div className="stagger space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display">OAuth 应用</h1>
          <p className="t-caption mt-1">管理你接入 MSAuth 的下游应用</p>
        </div>
        <Button onClick={() => setForm({ mode: 'create' })}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          注册应用
        </Button>
      </div>

      <div className="card rounded-card p-3">
        {query.isLoading ? (
          <div className="space-y-2 p-3" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-72" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        ) : clients.length === 0 ? (
          <EmptyState
            icon={AppWindow}
            title="暂无应用"
            desc="注册第一个 OAuth 客户端，让下游服务通过 MSAuth 完成登录与授权。"
          />
        ) : (
          <ul className="divide-y divide-line">
            {clients.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-start gap-x-4 gap-y-3 rounded-xl p-4 transition-colors duration-[140ms] hover:bg-canvas/70"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-action-subtle text-action">
                  <AppWindow size={20} strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm leading-5 font-semibold text-ink">{c.name}</span>
                    <Badge tone={c.clientType === 'confidential' ? 'blue' : 'neutral'}>{c.clientType}</Badge>
                    <span className="t-data inline-flex items-center" title={c.id}>
                      {c.id}
                      <CopyButton value={c.id} />
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="t-data truncate" title={c.redirectUris.join('\n')}>
                      {c.redirectUris[0]}
                      {c.redirectUris.length > 1 && <span className="text-ink-4"> +{c.redirectUris.length - 1}</span>}
                    </span>
                    <span className="t-data">
                      AT {fmtTtl(c.accessTokenTtlSeconds)} · RT {fmtTtl(c.refreshTokenTtlSeconds)}
                    </span>
                    <span className="t-data">创建于 {fmtDateTime(c.createdAt)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="允许的 scope">
                    {c.allowedScopes.slice(0, 3).map((scope) => (
                      <Badge key={scope}>{scope}</Badge>
                    ))}
                    {c.allowedScopes.length > 3 && <Badge tone="neutral">+{c.allowedScopes.length - 3}</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <Button variant="quiet" size="sm" onClick={() => setForm({ mode: 'edit', client: c })}>
                    编辑
                  </Button>
                  {c.clientType === 'confidential' && (
                    <Button variant="quiet" size="sm" onClick={() => setRotating(c)}>
                      轮换密钥
                    </Button>
                  )}
                  <Button
                    variant="quiet"
                    size="sm"
                    className="text-danger hover:text-danger"
                    onClick={() => setDeleting(c)}
                  >
                    删除
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {form !== null && (
        <ClientFormDialog
          client={form.mode === 'edit' ? form.client : null}
          pending={form.mode === 'edit' ? updateMutation.isPending : createMutation.isPending}
          onClose={() => setForm(null)}
          onSubmit={(input) => {
            if (form.mode === 'edit') {
              updateMutation.mutate({ id: form.client.id, input: input as ClientUpdateInput });
            } else {
              createMutation.mutate(input as ClientCreateInput);
            }
          }}
        />
      )}

      {secret !== null && (
        <SecretDialog
          secret={secret}
          onClose={() => {
            setSecret(null);
            void invalidate();
          }}
        />
      )}

      <Dialog
        open={rotating !== null}
        onClose={() => setRotating(null)}
        tone="danger"
        title="轮换密钥？"
        description="旧密钥将立即失效，使用它的服务会立刻认证失败；新密钥仅显示一次。"
        confirmText="确认轮换"
        loading={rotateMutation.isPending}
        onConfirm={() => rotating && rotateMutation.mutate(rotating.id)}
      />

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        tone="danger"
        title="删除应用？"
        description="将级联撤销该客户端签发的全部令牌与授权记录（含刷新令牌与用户同意），下游服务立即失去访问能力。此操作不可恢复。"
        confirmText="确认删除"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
