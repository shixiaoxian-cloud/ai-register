import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "总览", meta: "平台概览", icon: "overview" },
  { to: "/config", label: "配置中心", meta: "站点与方案", icon: "config" },
  { to: "/runs", label: "运行中心", meta: "执行与排查", icon: "runs" },
  { to: "/artifacts", label: "结果产物", meta: "报告与资产", icon: "artifacts" },
  { to: "/system", label: "系统设置", meta: "偏好与说明", icon: "system" }
];

export function AppShell() {
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

        <div className="sidebar__footer">
          <p>快捷入口</p>
          <a href="/report" target="_blank" rel="noreferrer">
            打开最新报告
          </a>
          <span>当前产品界面统一使用中文</span>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar__copy">
            <span className="topbar__kicker">平台工作台</span>
            <strong>统一管理站点、运行与结果</strong>
          </div>
          <div className="topbar__actions">
            <a href="/report" target="_blank" rel="noreferrer" className="ghost-button">
              最新报告
            </a>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
