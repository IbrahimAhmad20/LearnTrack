import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  courses as coursesApi,
  enrollments as enrollmentsApi,
  transactions as transactionsApi,
} from "../../api";
import { Spinner, EmptyState, SkeletonCard } from "../../components/ui";
import { CourseCard, useToast } from "../../components";

export default function CourseList() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState([]);
  const [enrolled, setEnrolled] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    Promise.all([coursesApi.list(), enrollmentsApi.list()])
      .then(([c, e]) => {
        setCourses(c.data.filter((course) => course.is_published));
        setEnrolled(new Set(e.data.map((en) => en.course_id)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleBuyOrEnroll = async (course) => {
    const courseId = course.course_id;
    setEnrolling(courseId);
    try {
      const res = await transactionsApi.initiate(courseId);
      if (res.data.free) {
        // Free course — already enrolled by backend
        setEnrolled((prev) => new Set([...prev, courseId]));
        navigate(`/student/courses/${courseId}`);
      } else {
        // Paid — open Safepay in new tab, go to polling page in this tab
        window.open(res.data.checkout_url, "_blank");
        window.location.href = `/payment/success?txId=${res.data.tx_id}`;
      }
    } catch (err) {
      const msg =
        err.response?.data?.error || "Could not process. Please try again.";
      showToast(msg, "error");
      setEnrolling(null);
    }
  };

  const filtered = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.category || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-8 page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-xl font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            Browse courses
          </h1>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {courses.length} courses available
          </p>
        </div>
        <input
          type="text"
          className="input-field"
          placeholder="Search courses…"
          value={search}
          onChange={(e) => {
            const next = e.target.value;
            setSearch(next);
            const sp = new URLSearchParams(searchParams);
            if (!next) sp.delete("q");
            else sp.set("q", next);
            setSearchParams(sp, { replace: true });
          }}
          style={{ maxWidth: 260 }}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="▦"
          title="No courses found"
          description={
            search ? `No results for "${search}"` : "No published courses yet"
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((course) => {
            const isEnrolled = enrolled.has(course.course_id);
            return (
              <CourseCard
                key={course.course_id}
                title={course.title}
                status={isEnrolled ? "enrolled" : "available"}
                progress={isEnrolled ? 100 : 0}
                description={course.description}
                instructor={course.instructors?.users?.full_name}
                thumbnail_url={course.thumbnail_url}
                action={
                  isEnrolled ? (
                    <button
                      onClick={() =>
                        navigate(`/student/courses/${course.course_id}`)
                      }
                      className="btn-ghost w-full justify-center text-xs py-1.5"
                    >
                      Continue →
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        navigate(`/student/courses/${course.course_id}`)
                      }
                      className="btn-primary w-full justify-center text-xs py-1.5"
                    >
                      {Number(course.price) > 0
                        ? `View — PKR ${Number(course.discounted_price ?? course.price).toLocaleString()}`
                        : "View course →"}
                    </button>
                  )
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
