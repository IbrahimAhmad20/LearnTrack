import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { ToastProvider } from "./components/Toast";
import InstructorLayout from "./layout/InstructorLayout";
import StudentLayout from "./layout/StudentLayout";
import AdminLayout from "./layout/AdminLayout";

import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

import InstructorDashboard from "./pages/instructor/Dashboard";
import ManageCourses from "./pages/instructor/ManageCourses";
import EditCourse from "./pages/instructor/EditCourse";
import InstructorAnalytics from "./pages/instructor/Analytics";
import InstructorReviews from "./pages/instructor/Reviews";
import Earnings from "./pages/instructor/Earnings";
import InstructorProfile from "./pages/instructor/Profile";

import StudentDashboard from "./pages/student/Dashboard";
import CourseList from "./pages/student/CourseList";
import CourseDetail from "./pages/student/CourseDetail";
import Quizzes from "./pages/student/Quizzes";
import Certificates from "./pages/student/Certificates";
import Notifications from "./pages/student/Notifications";
import Profile from "./pages/student/Profile";

import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminCourses from "./pages/admin/Courses";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminReviews from "./pages/admin/Reviews";

import CertificateVerify from "./pages/CertificateVerify";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify/:hash" element={<CertificateVerify />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />

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
              <Route path="reviews" element={<InstructorReviews />} />
              <Route path="earnings" element={<Earnings />} />
              <Route path="profile" element={<InstructorProfile />} />
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
              <Route path="certificates" element={<Certificates />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<Profile />} />
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
              <Route path="reviews" element={<AdminReviews />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
