"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/feature/site-header";
import { SiteFooter } from "@/components/feature/site-footer";

interface OamvState {
  oamv?: number;
  updatedAt?: string;
  updatedBy?: string;
  date?: string;
}

interface PrecomputeStatus {
  hasToday: boolean;
  date?: string;
  computedAt?: string;
  durationMs?: number;
  running: boolean;
  progress?: { scanned: number; total: number; startedAt: string | null };
}

function formatDateTime(iso?: string) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const [oamvInput, setOamvInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [oamvState, setOamvState] = useState<OamvState>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [pcStatus, setPcStatus] = useState<PrecomputeStatus | null>(null);
  const [pcTriggering, setPcTriggering] = useState(false);
  const [pcMsg, setPcMsg] = useState<string | null>(null);
  const [pcDone, setPcDone] = useState(false);
  const pcPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshPc = useCallback(async () => {
    try {
      const res = await fetch("/api/precompute", { cache: "no-store" });
      const data = (await res.json()) as PrecomputeStatus;
      setPcStatus(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const refreshOamv = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/oamv", { cache: "no-store" });
      const data = (await res.json()) as OamvState;
      setOamvState(data);
      if (typeof data.oamv === "number") {
        setOamvInput(data.oamv.toString());
      }
      if (data.updatedBy) {
        setNoteInput(data.updatedBy);
      }
    } catch {
      // 静默
    }
  }, []);

  // 探测登录态：尝试 POST 一次空数据，401 = 未登录，400 = 已登录但参数错
  const probeAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/oamv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.status === 401) {
        setAuthed(false);
      } else {
        setAuthed(true);
        await refreshOamv();
        await refreshPc();
      }
    } catch {
      setAuthed(false);
    }
  }, [refreshOamv, refreshPc]);

  useEffect(() => {
    probeAuth();
  }, [probeAuth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSubmitting(true);
    setPwError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `登录失败 (HTTP ${res.status})`);
      }
      setAuthed(true);
      setPassword("");
      await refreshOamv();
      await refreshPc();
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setOamvState({});
    setOamvInput("");
    setNoteInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMsg(null);
    try {
      const value = parseFloat(oamvInput);
      if (!Number.isFinite(value)) {
        throw new Error("请输入合法数字");
      }
      const res = await fetch("/api/admin/oamv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, note: noteInput || undefined }),
      });
      const data = (await res.json()) as OamvState & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `提交失败 (HTTP ${res.status})`);
      }
      setOamvState(data);
      setOkMsg(`已保存：OAMV = ${data.oamv?.toFixed(2)}%`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const stopPolling = useCallback(() => {
    if (pcPollRef.current) {
      clearInterval(pcPollRef.current);
      pcPollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pcPollRef.current) return; // 已在轮询
    const startedAt = Date.now();
    pcPollRef.current = setInterval(async () => {
      const data = await refreshPc();
      if (!data) return;
      // 完成判定：running=false 且 hasToday=true，或超过 30 分钟兜底停轮询
      const elapsed = Date.now() - startedAt;
      if (!data.running && data.hasToday) {
        setPcDone(true);
        setPcMsg("今日缓存已就绪，用户访问首页将直接秒回。");
        stopPolling();
      } else if (elapsed > 30 * 60 * 1000 && !data.running) {
        stopPolling();
      }
    }, 5000);
  }, [refreshPc, stopPolling]);

  // 卸载时清理定时器
  useEffect(() => () => stopPolling(), [stopPolling]);

  // 进入页面时若发现还在跑，自动接管轮询
  useEffect(() => {
    if (pcStatus?.running) startPolling();
  }, [pcStatus?.running, startPolling]);

  const handleTriggerPrecompute = async () => {
    setPcTriggering(true);
    setPcMsg(null);
    setPcDone(false);
    try {
      const res = await fetch("/api/precompute", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || `触发失败 HTTP ${res.status}`);
      setPcMsg(data.message ?? "已触发，进度会在下方实时更新。");
      await refreshPc();
      startPolling();
    } catch (err) {
      setPcMsg(err instanceof Error ? err.message : "触发失败");
    } finally {
      setPcTriggering(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-divider bg-card">
          <div className="container px-3 sm:px-5 py-8 md:py-12">
            <div className="font-serif-display text-[28px] md:text-[34px] leading-tight tracking-tight">
              管理员后台
            </div>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              用于手动录入指南针「活跃市值（OAMV）」涨跌幅。
              录入后在下次手动更新前将一直使用该值。所有数据存储在沙盒本地，重启或重新部署后需重新录入。
            </p>
          </div>
        </section>

        <section className="container px-3 sm:px-5 py-6 sm:py-8 md:py-10">
          {authed === null && (
            <div className="text-sm text-muted-foreground">正在验证登录状态…</div>
          )}

          {authed === false && (
            <div className="max-w-md border border-divider bg-card">
              <div className="px-5 py-4 border-b border-divider">
                <div className="font-serif-display text-lg">登录</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  管理员凭据由部署环境配置；未配置时登录功能保持关闭。
                </div>
              </div>
              <form onSubmit={handleLogin} className="px-5 py-5 space-y-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">
                    管理员密码
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="w-full border border-divider bg-background px-3 py-2 text-sm font-mono outline-none focus:border-foreground/60"
                  />
                </div>
                {pwError && (
                  <div className="text-xs text-[color:var(--signal-risk)]">{pwError}</div>
                )}
                <button
                  type="submit"
                  disabled={pwSubmitting || !password}
                  className="w-full bg-foreground text-background text-sm py-2.5 hover:opacity-90 disabled:opacity-50"
                >
                  {pwSubmitting ? "登录中…" : "登录"}
                </button>
              </form>
            </div>
          )}

          {authed === true && (
            <div className="space-y-6 max-w-4xl">
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div className="border border-divider bg-card">
                <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
                  <div>
                    <div className="font-serif-display text-lg">录入活跃市值 OAMV</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      百分比涨跌幅，例如 1.23（涨）/ -0.85（跌）
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    退出
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">
                      OAMV（%）
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={oamvInput}
                      onChange={(e) => setOamvInput(e.target.value)}
                      placeholder="例如 1.23 或 -0.85"
                      required
                      className="w-full border border-divider bg-background px-3 py-2 text-sm font-mono outline-none focus:border-foreground/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">
                      备注（可选）
                    </label>
                    <input
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="例如：来源指南针，14:50 截图"
                      maxLength={40}
                      className="w-full border border-divider bg-background px-3 py-2 text-sm outline-none focus:border-foreground/60"
                    />
                  </div>
                  {error && (
                    <div className="text-xs text-[color:var(--signal-risk)]">{error}</div>
                  )}
                  {okMsg && (
                    <div className="text-xs text-[color:var(--signal-pass)]">{okMsg}</div>
                  )}
                  <button
                    type="submit"
                    disabled={submitting || !oamvInput}
                    className="w-full bg-foreground text-background text-sm py-2.5 hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "保存中…" : "保存到首页"}
                  </button>
                </form>
              </div>

              <div className="border border-divider bg-card">
                <div className="px-5 py-4 border-b border-divider">
                  <div className="font-serif-display text-lg">当前生效值</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    首页大势裁定卡的「活跃市值 OAMV」会使用该值
                  </div>
                </div>
                <div className="px-5 py-5 space-y-3 text-sm">
                  <Row label="OAMV">
                    {typeof oamvState.oamv === "number" ? (
                      <span
                        className={
                          oamvState.oamv >= 0
                            ? "font-mono text-[color:var(--quote-up)]"
                            : "font-mono text-[color:var(--quote-down)]"
                        }
                      >
                        {oamvState.oamv >= 0 ? "+" : ""}
                        {oamvState.oamv.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">未录入（首页 OAMV 显示“——”）</span>
                    )}
                  </Row>
                  <Row label="录入时间">
                    <span className="font-mono text-xs">
                      {formatDateTime(oamvState.updatedAt)}
                    </span>
                  </Row>
                  <Row label="数据日期">
                    <span className="font-mono text-xs">{oamvState.date || "-"}</span>
                  </Row>
                  <Row label="备注">
                    <span className="text-xs">{oamvState.updatedBy || "-"}</span>
                  </Row>
                </div>
                <div className="px-5 py-4 border-t border-divider text-xs text-muted-foreground leading-relaxed">
                  注：当前录入仅对「今日（{new Date().toISOString().slice(0, 10)}）」生效。次日打开仍需重新录入，
                  避免使用过期数据。
                </div>
              </div>

              {/* 每日自动预计算 */}
              <div className="border border-divider bg-card">
                <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
                  <div>
                    <div className="font-serif-display text-lg">收盘后预计算</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      工作日 15:05 自动跑；也可手动点「立即执行」，
                      <span className="text-foreground">跑完后用户打开网页直接秒回</span>，无需等待筛选。
                    </div>
                  </div>
                  <button
                    onClick={handleTriggerPrecompute}
                    disabled={pcTriggering || pcStatus?.running}
                    className="text-xs border border-divider bg-background px-3 py-1.5 hover:bg-muted disabled:opacity-50"
                  >
                    {pcTriggering ? "触发中…" : pcStatus?.running ? "正在跑…" : "立即执行"}
                  </button>
                </div>
                <div className="px-5 py-5 space-y-3 text-sm">
                  <Row label="今日缓存">
                    {pcStatus?.hasToday ? (
                      <span className="font-mono text-[color:var(--signal-pass)]">已就绪</span>
                    ) : (
                      <span className="font-mono text-muted-foreground">未生成</span>
                    )}
                  </Row>
                  <Row label="缓存日期">
                    <span className="font-mono text-xs">{pcStatus?.date || "-"}</span>
                  </Row>
                  <Row label="完成时间">
                    <span className="font-mono text-xs">
                      {formatDateTime(pcStatus?.computedAt)}
                    </span>
                  </Row>
                  <Row label="本次耗时">
                    <span className="font-mono text-xs">
                      {typeof pcStatus?.durationMs === "number"
                        ? `${(pcStatus.durationMs / 1000).toFixed(1)}s`
                        : "-"}
                    </span>
                  </Row>
                  <Row label="运行状态">
                    <span
                      className={
                        pcStatus?.running
                          ? "text-[color:var(--quote-up)] text-xs"
                          : "text-muted-foreground text-xs"
                      }
                    >
                      {pcStatus?.running ? "进行中" : "空闲"}
                    </span>
                  </Row>

                  {pcStatus?.running && pcStatus.progress && pcStatus.progress.total > 0 && (
                    <div className="pt-1 space-y-1.5">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted-foreground">扫描进度</span>
                        <span className="font-mono">
                          {pcStatus.progress.scanned} / {pcStatus.progress.total}
                          <span className="text-muted-foreground">
                            {" "}
                            ({((pcStatus.progress.scanned / pcStatus.progress.total) * 100).toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-divider/40 overflow-hidden">
                        <div
                          className="h-full bg-foreground transition-[width] duration-500"
                          style={{
                            width: `${Math.min(100, (pcStatus.progress.scanned / pcStatus.progress.total) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        预计共需 10-20 分钟，跑完后无需停留在此页，用户访问首页会自动读到新缓存。
                      </div>
                    </div>
                  )}

                  {pcDone && (
                    <div className="px-3 py-2 border border-[color:var(--signal-pass)]/40 text-[color:var(--signal-pass)] text-xs">
                      ✓ 今日筛选缓存已落盘，用户打开网页将直接读取，无需等待。
                    </div>
                  )}

                  {pcMsg && !pcDone && (
                    <div className="text-xs text-[color:var(--signal-pass)]">{pcMsg}</div>
                  )}
                </div>
              </div>
            </div>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-right">{children}</div>
    </div>
  );
}
