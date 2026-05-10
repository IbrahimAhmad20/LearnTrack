import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-base)" }}>
      <Sidebar role="admin" />
      <main className="flex-1 overflow-y-auto">
        <Navbar title="Admin Workspace" searchPlaceholder="Search users or courses..." />
        <Outlet />
      </main>
    </div>
  );
}
