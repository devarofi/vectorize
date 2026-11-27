/**
 * Small History API router for the initial editor shell.
 * Vite's SPA fallback serves index.html for direct navigation to /editor.
 */
export function createRouter({ routes, outlet, onRoute }) {
  const resolve = () => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const route = routes[path] || routes['*'];
    if (route) onRoute(route, path);
  };

  const navigate = (path) => {
    const target = path.startsWith('/') ? path : `/${path}`;
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target);
    }
    resolve();
  };

  window.addEventListener('popstate', resolve);
  resolve();

  return {
    navigate,
    destroy() {
      window.removeEventListener('popstate', resolve);
    },
  };
}
