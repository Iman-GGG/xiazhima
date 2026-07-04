/**
 * SBCycleLoader — 个股解析加载动画
 *
 * 循环（~2.4s）：
 *   线从底部左 45° 向右上画 → 触顶 S 硬币弹跳 → 线转折 45° 右下画 → 触底 B 硬币弹跳 → 循环
 */
export default function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="relative" style={{ width: 160, height: 200 }}>
        <svg
          viewBox="0 0 160 200"
          className="w-full h-full"
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* S 硬币渐变 */}
            <radialGradient id="g-s" cx="40%" cy="35%">
              <stop offset="0%" stopColor="var(--quote-up)" />
              <stop offset="100%" stopColor="var(--quote-up)" stopOpacity="0.6" />
            </radialGradient>
            {/* B 硬币渐变 */}
            <radialGradient id="g-b" cx="40%" cy="35%">
              <stop offset="0%" stopColor="var(--signal-pass)" />
              <stop offset="100%" stopColor="var(--signal-pass)" stopOpacity="0.6" />
            </radialGradient>
            {/* 线渐变尾部消失 */}
            <linearGradient id="fade-up" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="var(--quote-up)" stopOpacity="0" />
              <stop offset="30%" stopColor="var(--quote-up)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--quote-up)" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="fade-down" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--signal-pass)" stopOpacity="1" />
              <stop offset="70%" stopColor="var(--signal-pass)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--signal-pass)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 框 */}
          <rect x="10" y="10" width="140" height="180" fill="none" stroke="var(--color-border)" strokeWidth="0.5" rx="4" />

          {/* === 上升线（右上 45°）=== */}
          <line
            x1="30"
            y1="170"
            x2="130"
            y2="70"
            stroke="url(#fade-up)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="141"
            strokeDashoffset="141"
          >
            <animate
              attributeName="stroke-dashoffset"
              values="141;0;0;0"
              keyTimes="0;0.18;0.7;1"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </line>

          {/* === 下降线（右下 45°）=== */}
          <line
            x1="60"
            y1="70"
            x2="140"
            y2="150"
            stroke="url(#fade-down)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="113"
            strokeDashoffset="113"
          >
            <animate
              attributeName="stroke-dashoffset"
              values="113;113;113;0;0"
              keyTimes="0;0.35;0.42;0.6;1"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </line>

          {/* === S 硬币（顶部）=== */}
          <g>
            <animate
              attributeName="opacity"
              values="0;0;1;1;0;0"
              keyTimes="0;0.18;0.22;0.32;0.36;1"
              dur="2.4s"
              repeatCount="indefinite"
            />
            <circle cx="120" cy="65" r="14" fill="url(#g-s)" stroke="var(--quote-up)" strokeWidth="1">
              <animate
                attributeName="r"
                values="0;17;14;14;14"
                keyTimes="0;0.22;0.25;0.32;0.36"
                dur="2.4s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0 0.7 1 1.3;0.3 0 0.7 1;0 0 1 1;0 0 1 1"
              />
            </circle>
            <text
              x="120"
              y="69"
              textAnchor="middle"
              fontSize="12"
              fontWeight="bold"
              fill="white"
            >
              S
              <animate
                attributeName="opacity"
                values="0;0;0;1;1;0"
                keyTimes="0;0.2;0.23;0.26;0.34;0.36"
                dur="2.4s"
                repeatCount="indefinite"
              />
            </text>
          </g>

          {/* === B 硬币（底部）=== */}
          <g>
            <animate
              attributeName="opacity"
              values="0;0;0;1;1;0"
              keyTimes="0;0.55;0.6;0.64;0.74;0.78"
              dur="2.4s"
              repeatCount="indefinite"
            />
            <circle cx="135" cy="150" r="14" fill="url(#g-b)" stroke="var(--signal-pass)" strokeWidth="1">
              <animate
                attributeName="r"
                values="0;17;14;14;14"
                keyTimes="0;0.6;0.63;0.7;0.74"
                dur="2.4s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0 0.7 1 1.3;0.3 0 0.7 1;0 0 1 1;0 0 1 1"
              />
            </circle>
            <text
              x="135"
              y="154"
              textAnchor="middle"
              fontSize="12"
              fontWeight="bold"
              fill="white"
            >
              B
              <animate
                attributeName="opacity"
                values="0;0;0;1;1;0"
                keyTimes="0;0.58;0.61;0.64;0.72;0.74"
                dur="2.4s"
                repeatCount="indefinite"
              />
            </text>
          </g>
        </svg>
        <p className="text-[11px] text-muted-foreground text-center mt-2">正在拉取行情数据…</p>
      </div>
    </div>
  );
}
