/**
 * 统一错误码与 AppError。
 *
 * 约定：
 * - API 层不抛裸 Error，一律抛 AppError；全局 error 中间件按 toJSON() 输出统一格式。
 * - OAuth 相关错误码的取值遵循 RFC 6749（invalid_client / invalid_grant …），
 *   以便 /oauth/token 直接把 code 写进响应体。
 * - message 是给最终用户看的中文提示，不得包含内部细节。
 */

/** 统一错误码：key 供代码引用，value 是对外暴露的 wire code */
export const ERROR_CODES = {
  // —— 通用 ——
  INTERNAL: 'internal_error',
  VALIDATION: 'validation_error',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',

  // —— 认证（/api/auth/*）——
  INVALID_CREDENTIALS: 'invalid_credentials',
  EMAIL_TAKEN: 'email_already_registered',
  SESSION_EXPIRED: 'session_expired',
  CSRF_INVALID: 'csrf_invalid',
  GITHUB_AUTH_FAILED: 'github_auth_failed',

  // —— OAuth 2.1（wire code 兼容 RFC 6749）——
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  INVALID_GRANT: 'invalid_grant',
  INVALID_SCOPE: 'invalid_scope',
  INVALID_REDIRECT_URI: 'invalid_redirect_uri',
  INVALID_TOKEN: 'invalid_token',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  ACCESS_DENIED: 'access_denied',
  CONSENT_REQUIRED: 'consent_required',
  CONSENT_EXPIRED: 'consent_expired',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/** 每个错误码的默认 HTTP 状态码与默认提示 */
const ERROR_DEFAULTS: Record<ErrorCode, { status: number; message: string }> = {
  INTERNAL: { status: 500, message: '服务器内部错误，请稍后再试' },
  VALIDATION: { status: 400, message: '请求参数不正确' },
  UNAUTHORIZED: { status: 401, message: '请先登录' },
  FORBIDDEN: { status: 403, message: '没有权限执行此操作' },
  NOT_FOUND: { status: 404, message: '资源不存在' },
  CONFLICT: { status: 409, message: '请求与当前状态冲突' },
  RATE_LIMITED: { status: 429, message: '请求过于频繁，请稍后再试' },

  INVALID_CREDENTIALS: { status: 401, message: '邮箱或密码不正确' },
  EMAIL_TAKEN: { status: 409, message: '该邮箱已被注册' },
  SESSION_EXPIRED: { status: 401, message: '会话已过期，请重新登录' },
  CSRF_INVALID: { status: 403, message: '请求校验失败，请刷新页面重试' },
  GITHUB_AUTH_FAILED: { status: 401, message: 'GitHub 登录失败' },

  INVALID_REQUEST: { status: 400, message: '请求参数缺失或格式不正确' },
  INVALID_CLIENT: { status: 401, message: '客户端认证失败' },
  INVALID_GRANT: { status: 400, message: '授权码或令牌无效、已过期或已被使用' },
  INVALID_SCOPE: { status: 400, message: '请求的 scope 无效或超出客户端允许范围' },
  INVALID_REDIRECT_URI: { status: 400, message: '回调地址未注册，拒绝继续授权' },
  INVALID_TOKEN: { status: 401, message: '令牌无效或已过期' },
  UNSUPPORTED_GRANT_TYPE: { status: 400, message: '不支持的授权模式' },
  UNSUPPORTED_RESPONSE_TYPE: { status: 400, message: '不支持的响应类型' },
  UNAUTHORIZED_CLIENT: { status: 401, message: '该客户端无权使用此授权模式' },
  ACCESS_DENIED: { status: 403, message: '用户或管理员拒绝了本次授权' },
  CONSENT_REQUIRED: { status: 401, message: '需要先完成授权确认' },
  CONSENT_EXPIRED: { status: 400, message: '授权请求已过期，请重新发起' },
};

export interface AppErrorInit {
  code: ErrorCode;
  /** 覆盖默认提示 */
  message?: string;
  /** 覆盖默认状态码 */
  status?: number;
  /** 附加上下文（如 Zod 校验错误明细），会原样出现在响应里，注意不要放敏感信息 */
  details?: unknown;
  cause?: unknown;
}

/** 全应用统一错误类型：API 各层显式抛出，全局 error 中间件统一兜底 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(init: AppErrorInit) {
    const defaults = ERROR_DEFAULTS[init.code];
    super(init.message ?? defaults.message, { cause: init.cause });
    this.name = 'AppError';
    this.code = init.code;
    this.status = init.status ?? defaults.status;
    this.details = init.details;
  }

  /** 统一响应体：{ error: wire code, message, details? } */
  toJSON(): { error: string; message: string; details?: unknown } {
    const body: { error: string; message: string; details?: unknown } = {
      error: ERROR_CODES[this.code],
      message: this.message,
    };
    if (this.details !== undefined) body.details = this.details;
    return body;
  }
}

/** 类型守卫：全局 error 中间件用来区分 AppError 与未知异常 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
