import { NavLink, Outlet, useLocation } from "react-router-dom";

const navItems = [
  { to: "/", label: "仪表盘", meta: "平台概览与健康", icon: "overview" },
  { to: "/config", label: "配置中心", meta: "站点、方案与画像", icon: "config" },
  { to: "/runs", label: "运行监控", meta: "执行、日志与介入", icon: "runs" },
  { to: "/artifacts", label: "产物中心", meta: "报告、Trace 与令牌", icon: "artifacts" },
  { to: "/system", label: "系统设置", meta: "偏好、入口与说明", icon: "system" }
];

export function AppShell() {
  const location = useLocation();
  const activeItem =
    navItems.find((item) =>
      item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)
    ) || navItems[0];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__mark">AP</div>
          <div className="sidebar__brand-copy">
            <strong>Auto Console</strong>
            <span>授权保护验证后台</span>
            <small className="sidebar__version">v0.1.0</small>
          </div>
        </div>

        <div className="sidebar__section">
          <div className="sidebar__section-label">平台空间</div>
          <nav className="sidebar__nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  isActive ? "sidebar__link is-active" : "sidebar__link"
                }
              >
                <span
                  className={`sidebar__icon sidebar__icon--${item.icon}`}
                  aria-hidden="true"
                />
                <span className="sidebar__link-copy">
                  <span className="sidebar__label">{item.label}</span>
                  <small>{item.meta}</small>
                </span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar__footer">
          <div className="sidebar__section-label">控制台说明</div>
          <p>安全边界</p>
          <span>只验证保护流程是否触发、拦截以及人工完成后能否继续。</span>
          <a href="/report" target="_blank" rel="noreferrer">
            打开最新报告
          </a>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar__copy">
            <span className="topbar__kicker">{activeItem.label}</span>
            <strong>{activeItem.meta}</strong>
          </div>
          <div className="topbar__actions">
            <button type="button" className="topbar__icon-button" aria-label="通知中心">
              <span className="sidebar__icon sidebar__icon--bell" aria-hidden="true" />
            </button>
            <span className="topbar__chip">CN ZH</span>
            <span className="topbar__chip topbar__chip--accent">SQLite 已连接</span>
            <div className="topbar__profile">
              <span className="topbar__avatar">OP</span>
              <span className="topbar__profile-copy">
                <strong>operator</strong>
                <small>Admin</small>
              </span>
            </div>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
