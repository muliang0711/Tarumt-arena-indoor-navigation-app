export function Navigation({ page }: { page: "dashboard" | "live" }) {
  return <header className="admin-header">
    <a className="admin-brand" href="/"><b>TA</b><span>Arena</span></a>
    <nav aria-label="Main navigation"><a href="/" aria-current={page === "dashboard" ? "page" : undefined}>Dashboard</a><a href="/live" aria-current={page === "live" ? "page" : undefined}>Live map</a></nav>
    <span className="campus-name">Main Campus · Floor 2</span>
  </header>;
}
