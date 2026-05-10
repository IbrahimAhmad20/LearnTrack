import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "./Login";

const loginMock = vi.fn();

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    login: loginMock,
  }),
}));

function renderWithRoutes(initialPath = "/login", state) {
  render(
    <MemoryRouter initialEntries={[{ pathname: initialPath, state }]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/student" element={<div>Student Home</div>} />
        <Route path="/student/courses" element={<div>Return Target</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Login integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("redirects to role home path after successful login", async () => {
    loginMock.mockResolvedValue({
      role: "student",
    });

    renderWithRoutes();
    const user = userEvent.setup();

    await user.type(
      screen.getByPlaceholderText("you@university.edu"),
      "student@test.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "Password123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByText("Student Home")).toBeInTheDocument(),
    );
  });

  test("redirects to previous protected route from location state", async () => {
    loginMock.mockResolvedValue({
      role: "student",
    });

    renderWithRoutes("/login", { from: { pathname: "/student/courses" } });
    const user = userEvent.setup();

    await user.type(
      screen.getByPlaceholderText("you@university.edu"),
      "student@test.com",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "Password123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByText("Return Target")).toBeInTheDocument(),
    );
  });
});
