/** 账户活动统计类型（数据可视化数据源） */

/** 单日登录统计（UTC 日聚合） */
export interface LoginDailyStat {
  /** YYYY-MM-DD（UTC） */
  date: string;
  success: number;
  failure: number;
}

/** 登录活跃响应：固定返回最近 14 天，无记录的日子补零 */
export interface LoginStatsResponse {
  days: LoginDailyStat[];
}
