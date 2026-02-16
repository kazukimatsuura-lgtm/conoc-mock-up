// クライアント側レート制限ユーティリティ

interface RateLimitConfig {
  maxRequests: number;  // 最大リクエスト数
  windowMs: number;     // 時間枠（ミリ秒）
}

interface RateLimitState {
  count: number;
  resetAt: number;
}

const STORAGE_KEY_PREFIX = 'rate_limit_';

/**
 * レート制限をチェック
 * @returns true = リクエスト許可, false = 制限中
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 }
): { allowed: boolean; remaining: number; resetIn: number } {
  const storageKey = STORAGE_KEY_PREFIX + key;
  const now = Date.now();

  // 現在の状態を取得
  let state: RateLimitState;
  try {
    const stored = localStorage.getItem(storageKey);
    state = stored ? JSON.parse(stored) : { count: 0, resetAt: now + config.windowMs };
  } catch {
    state = { count: 0, resetAt: now + config.windowMs };
  }

  // 時間枠がリセットされた場合
  if (now >= state.resetAt) {
    state = { count: 0, resetAt: now + config.windowMs };
  }

  const remaining = Math.max(0, config.maxRequests - state.count);
  const resetIn = Math.max(0, state.resetAt - now);

  if (state.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetIn };
  }

  // カウントを増やして保存
  state.count++;
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // localStorage がフルの場合は無視
  }

  return { allowed: true, remaining: remaining - 1, resetIn };
}

/**
 * レート制限をリセット
 */
export function resetRateLimit(key: string): void {
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + key);
  } catch {
    // 無視
  }
}

// AI API用のレート制限設定
export const AI_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 20,   // 1分間に20リクエストまで
  windowMs: 60000,   // 1分
};

// 画像処理用のレート制限設定
export const IMAGE_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 50,   // 1分間に50リクエストまで
  windowMs: 60000,
};
