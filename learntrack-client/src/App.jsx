import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { ToastProvider } from "./components/Toast";
import InstructorLayout from "./layout/InstructorLayout";
import StudentLayout from "./layout/StudentLayout";
import AdminLayout from "./layout/AdminLayout";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

import InstructorDashboard from "./pages/instructor/Dashboard";
import ManageCourses from "./pages/instructor/ManageCourses";
import EditCourse from "./pages/instructor/EditCourse";
import InstructorAnalytics from "./pages/instructor/Analytics";

import StudentDashboard from "./pages/student/Dashboard";
import CourseList from "./pages/student/CourseList";
import CourseDetail from "./pages/student/CourseDetail";
import Quizzes from "./pages/student/Quizzes";

import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminCourses from "./pages/admin/Courses";
import AdminAnalytics from "./pages/admin/Analytics";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Instructor */}
          <Route
            path="/instructor"
            element={
              <ProtectedRoute roles={["instructor"]}>
                <InstructorLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<InstructorDashboard />} />
            <Route path="courses" element={<ManageCourses />} />
            <Route path="courses/:id" element={<EditCourse />} />
            <Route path="analytics" element={<InstructorAnalytics />} />
          </Route>

          {/* Student */}
          <Route
            path="/student"
            element={
              <ProtectedRoute roles={["student"]}>
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<StudentDashboard />} />
            <Route path="courses" element={<CourseList />} />
            <Route path="courses/:id" element={<CourseDetail />} />
            <Route path="quizzes" element={<Quizzes />} />
          </Route>

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="courses" element={<AdminCourses />} />
            <Route path="analytics" element={<AdminAnalytics />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
