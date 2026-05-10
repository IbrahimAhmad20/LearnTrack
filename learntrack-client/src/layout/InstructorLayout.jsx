import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

export default function InstructorLayout() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-base)" }}>
      <Sidebar role="instructor" />
      <main className="flex-1 overflow-y-auto">
        <Navbar title="Instructor Workspace" searchPlaceholder="Search courses..." />
        <Outlet />
      </main>
    </div>
  );
}
