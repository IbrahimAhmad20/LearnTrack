import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CourseList from "./CourseList";
import { ToastProvider } from "../../components/Toast";

const listCoursesMock = vi.fn();
const listEnrollmentsMock = vi.fn();
const enrollMock = vi.fn();

vi.mock("../../api", () => ({
  courses: {
    list: (...args) => listCoursesMock(...args),
  },
  enrollments: {
    list: (...args) => listEnrollmentsMock(...args),
    enroll: (...args) => enrollMock(...args),
  },
}));

function renderPage() {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/student/courses"]}>
        <Routes>
          <Route path="/student/courses" element={<CourseList />} />
          <Route path="/student/courses/:id" element={<div>Course Detail</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe("CourseList integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCoursesMock.mockResolvedValue({
      data: [
        {
          course_id: 42,
          title: "Intro SQL",
          category: "Databases",
          description: "Learn SQL basics",
          is_published: true,
        },
      ],
    });
    listEnrollmentsMock.mockResolvedValue({ data: [] });
    enrollMock.mockResolvedValue({ data: { enrollment_id: 1 } });
  });

  test("loads courses and allows enrolling into a course", async () => {
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText("Intro SQL")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enroll" }));

    await waitFor(() => expect(enrollMock).toHaveBeenCalledWith(42));
    await waitFor(() =>
      expect(screen.getByText("Course Detail")).toBeInTheDocument(),
    );
  });
});
