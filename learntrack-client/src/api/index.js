import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  timeout: 15000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("lt_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global 401 handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("lt_token");
      localStorage.removeItem("lt_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export default api;

// ── Typed helpers ──────────────────────────────────────────────────────────

export const auth = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/users/me"),
};

export const courses = {
  list: (params) => api.get("/courses", { params }),
  /** Published catalogue (all instructors). Students browse this. */
  listMine: () => api.get("/courses/mine"),
  get: (id) => api.get(`/courses/${id}`),
  create: (data) => api.post("/courses", data),
  update: (id, data) => api.put(`/courses/${id}`, data),
  delete: (id) => api.delete(`/courses/${id}`),
  addContent: (id, data) => api.post(`/courses/${id}/content`, data),
  updateContent: (id, contentId, data) =>
    api.put(`/courses/${id}/content/${contentId}`, data),
  deleteContent: (id, contentId) => api.delete(`/courses/${id}/content/${contentId}`),
  students: (id) => api.get(`/courses/${id}/students`),
};

export const analytics = {
  activeStudents: (params) => api.get("/analytics/active-students", { params }),
  completionRates: (params) =>
    api.get("/analytics/completion-rates", { params }),
  underperforming: (params) =>
    api.get("/analytics/underperforming", { params }),
  skippedContent: (params) =>
    api.get("/analytics/skipped-content", { params }),
  instructorDash: (courseId) => api.get(`/analytics/instructor/${courseId}`),
  adminDashboard: () => api.get("/analytics/dashboard/admin"),
};

const mapEnrollment = (row) => ({
  enrollment_id: row.enrollment_id,
  enrolled_at: row.enrolled_at,
  status_name: row.enrollment_statuses?.status_name || null,
  course_id: row.courses?.course_id,
  title: row.courses?.title,
  description: row.courses?.description,
  category: row.courses?.category,
  thumbnail_url: row.courses?.thumbnail_url,
  instructor_name: row.courses?.instructors?.users?.full_name || null,
});

export const enrollments = {
  list: async () => {
    const res = await api.get("/enrollments/my");
    return { ...res, data: (res.data || []).map(mapEnrollment) };
  },
  enroll: (courseId) => api.post(`/enrollments/${courseId}`),
  progress: async (courseId) => {
    const res = await api.get("/progress/me");
    const courseItems = (res.data || []).filter(
      (item) => item.content?.course_id === Number(courseId),
    );
    const avg =
      courseItems.length > 0
        ? courseItems.reduce((sum, item) => sum + (item.progress_percent || 0), 0) /
          courseItems.length
        : 0;
    return { ...res, data: { progress_pct: Math.round(avg) } };
  },
};

export const quizzes = {
  list: async (courseId) => {
    const res = await api.get(`/courses/${courseId}`);
    return { ...res, data: res.data?.quizzes || [] };
  },
  myAttempts: (params) => api.get("/quizzes/attempts/me", { params }),
  get: (quizId) => api.get(`/quizzes/${quizId}`),
  questionTypes: () => api.get("/quizzes/question-types"),
  create: (data) => api.post("/quizzes", data),
  update: (quizId, data) => api.patch(`/quizzes/${quizId}`, data),
  addQuestion: (quizId, data) => api.post(`/quizzes/${quizId}/questions`, data),
  submit: (quizId, answers) => api.post(`/quizzes/${quizId}/attempt`, { answers }),
};

export const progress = {
  update: (contentId, progress_percent) =>
    api.put(`/progress/${contentId}`, { progress_percent }),
};

export const activity = {
  log: (content_id, event_type, watch_time = 0) =>
    api.post("/activity", { content_id, event_type, watch_time }),
};

export const instructors = {
  updateMe: (data) => api.put("/instructors/me", data),
};

export const admin = {
  users: (params) => api.get("/users", { params }),
  updateUserStatus: (userId, is_active) =>
    api.put(`/users/${userId}/status`, { is_active }),
  deleteUser: (userId) => api.delete(`/users/${userId}`),
  allCourses: (params) => api.get("/courses", { params }),
  deleteCourse: (id) => api.delete(`/courses/${id}`),
};
