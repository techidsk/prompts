import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  Link,
  useRouterState,
} from "@tanstack/react-router";
import PlaygroundPage from "./pages/PlaygroundPage";
import HistoryPage from "./pages/HistoryPage";

// Header 组件
function Header() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const navItems = [
    { path: "/", label: "Playground", icon: "⚡" },
    { path: "/history", label: "历史记录", icon: "📋" },
  ];

  return (
    <header className="h-14 bg-surface-900/80 backdrop-blur-md border-b border-surface-800 flex items-center px-6 sticky top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-8">
        <span className="text-xl">⚡</span>
        <span className="font-semibold text-white tracking-tight">Prompt Playground</span>
      </div>

      {/* 导航 */}
      <nav className="flex items-center gap-1">
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                isActive
                  ? "bg-accent/20 text-accent"
                  : "text-surface-400 hover:text-white hover:bg-surface-800"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 右侧空间 */}
      <div className="flex-1" />

      {/* 状态指示器 */}
      <div className="flex items-center gap-2 text-xs text-surface-500">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Ready</span>
      </div>
    </header>
  );
}

// 根布局
function RootLayout() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}

// 创建根路由
const rootRoute = createRootRoute({
  component: RootLayout,
});

// Search params 类型
interface PlaygroundSearch {
  historyId?: number;
  promptId?: string;
  modelId?: string;
}

// 创建页面路由
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: PlaygroundPage,
  validateSearch: (search: Record<string, unknown>): PlaygroundSearch => {
    return {
      historyId: search.historyId ? Number(search.historyId) : undefined,
      promptId: search.promptId as string | undefined,
      modelId: search.modelId as string | undefined,
    };
  },
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryPage,
});

// 路由树
const routeTree = rootRoute.addChildren([indexRoute, historyRoute]);

// 创建路由器
export const router = createRouter({ routeTree });

// 类型声明
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
