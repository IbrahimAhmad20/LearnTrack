import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

export default function Landing() {
  const { theme, toggle } = useTheme();
  const observerRef = useRef(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("lt-visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    document.querySelectorAll(".lt-fade").forEach((el) => {
      observerRef.current.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <>
      <style>{`
        /* ── Landing-scoped CSS variables ── */
        .lt-root {
          --lt-bg:              #0b0d10;
          --lt-bg2:             #13161c;
          --lt-bg3:             #1c2028;
          --lt-surface:         #222730;
          --lt-border:          rgba(255,255,255,0.07);
          --lt-border-strong:   rgba(255,255,255,0.14);
          --lt-text:            #f0f2f5;
          --lt-text-muted:      #8a9ab5;
          --lt-text-faint:      #4a5568;
          --lt-accent:          #4f8ef7;
          --lt-accent2:         #7c3aed;
          --lt-accent-glow:     rgba(79,142,247,0.15);
          --lt-accent2-glow:    rgba(124,58,237,0.15);
          --lt-pill-bg:         rgba(79,142,247,0.12);
          --lt-pill-text:       #7eb3ff;
          --lt-card-bg:         #1a1e27;
          --lt-nav-bg:          rgba(11,13,16,0.85);
          --lt-hero-grad:       linear-gradient(135deg,#0b0d10 0%,#111520 50%,#0d0f15 100%);
          --lt-btn-primary:     linear-gradient(135deg,#4f8ef7,#7c3aed);
          --lt-btn-sec-bg:      rgba(255,255,255,0.05);
          --lt-btn-sec-border:  rgba(255,255,255,0.12);
          --lt-stat-bg:         rgba(255,255,255,0.04);
          --lt-tag-ins:         rgba(124,58,237,0.15);
          --lt-tag-ins-text:    #a78bfa;
          --lt-tag-stu:         rgba(16,185,129,0.15);
          --lt-tag-stu-text:    #34d399;
          --lt-tag-adm:         rgba(245,158,11,0.15);
          --lt-tag-adm-text:    #fbbf24;
          --lt-shadow:          0 8px 32px rgba(0,0,0,0.4);
          --lt-tr:              all 0.35s cubic-bezier(0.4,0,0.2,1);
        }

        .lt-root[data-theme="light"] {
          --lt-bg:              #f8f9fc;
          --lt-bg2:             #ffffff;
          --lt-bg3:             #f0f2f8;
          --lt-surface:         #e8ecf4;
          --lt-border:          rgba(0,0,0,0.07);
          --lt-border-strong:   rgba(0,0,0,0.14);
          --lt-text:            #0f1117;
          --lt-text-muted:      #5a6480;
          --lt-text-faint:      #9aa3bb;
          --lt-accent:          #2563eb;
          --lt-accent2:         #6d28d9;
          --lt-accent-glow:     rgba(37,99,235,0.1);
          --lt-accent2-glow:    rgba(109,40,217,0.1);
          --lt-pill-bg:         rgba(37,99,235,0.08);
          --lt-pill-text:       #2563eb;
          --lt-card-bg:         #ffffff;
          --lt-nav-bg:          rgba(248,249,252,0.9);
          --lt-hero-grad:       linear-gradient(135deg,#f8f9fc 0%,#eef1fb 50%,#f5f3ff 100%);
          --lt-btn-primary:     linear-gradient(135deg,#2563eb,#6d28d9);
          --lt-btn-sec-bg:      rgba(0,0,0,0.04);
          --lt-btn-sec-border:  rgba(0,0,0,0.12);
          --lt-stat-bg:         rgba(0,0,0,0.04);
          --lt-tag-ins:         rgba(109,40,217,0.08);
          --lt-tag-ins-text:    #6d28d9;
          --lt-tag-stu:         rgba(5,150,105,0.08);
          --lt-tag-stu-text:    #059669;
          --lt-tag-adm:         rgba(180,83,9,0.08);
          --lt-tag-adm-text:    #b45309;
          --lt-shadow:          0 4px 24px rgba(0,0,0,0.08);
        }

        /* ── Reset (scoped) ── */
        .lt-root *, .lt-root *::before, .lt-root *::after {
          box-sizing: border-box; margin: 0; padding: 0;
        }
        .lt-root {
          font-family: 'DM Sans', sans-serif;
          background: var(--lt-bg);
          color: var(--lt-text);
          line-height: 1.6;
          transition: var(--lt-tr);
          overflow-x: hidden;
          min-height: 100dvh;
        }

        /* ── NAV ── */
        .lt-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          background: var(--lt-nav-bg);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--lt-border);
          padding: 0 5%; height: 64px;
          display: flex; align-items: center; justify-content: space-between;
          transition: var(--lt-tr);
        }
        .lt-logo {
          font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.3rem;
          letter-spacing: -0.02em; color: var(--lt-text); text-decoration: none;
          display: flex; align-items: center; gap: 8px;
        }
        .lt-logo-badge {
          background: var(--lt-btn-primary); color: white;
          font-size: 0.65rem; font-weight: 700;
          padding: 2px 7px; border-radius: 20px; letter-spacing: 0.04em;
        }
        .lt-nav-links {
          display: flex; align-items: center; gap: 32px; list-style: none;
        }
        .lt-nav-links a {
          text-decoration: none; color: var(--lt-text-muted);
          font-size: 0.9rem; font-weight: 400; transition: color 0.2s;
        }
        .lt-nav-links a:hover { color: var(--lt-text); }
        .lt-nav-right { display: flex; align-items: center; gap: 12px; }

        /* ── Theme Toggle ── */
        .lt-toggle {
          width: 52px; height: 28px;
          background: var(--lt-surface);
          border: 1px solid var(--lt-border-strong);
          border-radius: 20px; cursor: pointer;
          position: relative; transition: var(--lt-tr); flex-shrink: 0;
        }
        .lt-toggle::after {
          content: '';
          position: absolute; top: 3px; left: 3px;
          width: 20px; height: 20px; border-radius: 50%;
          background: var(--lt-btn-primary);
          transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
        }
        .lt-root[data-theme="light"] .lt-toggle::after { transform: translateX(24px); }
        .lt-toggle-icon {
          position: absolute; top: 50%; transform: translateY(-50%);
          font-size: 11px; pointer-events: none;
        }
        .lt-icon-moon { left: 6px; }
        .lt-icon-sun  { right: 5px; }

        /* ── Buttons ── */
        .lt-btn-nav {
          background: var(--lt-btn-primary); color: white; border: none;
          padding: 8px 20px; border-radius: 8px;
          font-family: 'DM Sans', sans-serif; font-size: 0.875rem; font-weight: 500;
          cursor: pointer; text-decoration: none;
          transition: opacity 0.2s, transform 0.1s;
        }
        .lt-btn-nav:hover { opacity: 0.88; transform: translateY(-1px); }
        .lt-btn-primary {
          background: var(--lt-btn-primary); color: white; border: none;
          padding: 14px 32px; border-radius: 10px;
          font-family: 'DM Sans', sans-serif; font-size: 1rem; font-weight: 500;
          cursor: pointer; text-decoration: none;
          display: inline-flex; align-items: center; gap: 8px;
          transition: opacity 0.2s, transform 0.15s;
        }
        .lt-btn-primary:hover { opacity: 0.88; transform: translateY(-2px); }
        .lt-btn-secondary {
          background: var(--lt-btn-sec-bg); color: var(--lt-text);
          border: 1px solid var(--lt-btn-sec-border);
          padding: 14px 32px; border-radius: 10px;
          font-family: 'DM Sans', sans-serif; font-size: 1rem; font-weight: 400;
          cursor: pointer; text-decoration: none;
          display: inline-flex; align-items: center; gap: 8px;
          transition: all 0.2s;
        }
        .lt-btn-secondary:hover {
          background: var(--lt-surface); border-color: var(--lt-border-strong);
        }

        /* ── Hero ── */
        .lt-hero {
          min-height: 100vh; background: var(--lt-hero-grad);
          display: flex; align-items: center;
          padding: 120px 5% 80px;
          position: relative; overflow: hidden;
        }
        .lt-orb {
          position: absolute; border-radius: 50%;
          filter: blur(90px); pointer-events: none; transition: var(--lt-tr);
        }
        .lt-orb1 {
          width: 500px; height: 500px; background: var(--lt-accent-glow);
          top: -100px; right: -100px;
        }
        .lt-orb2 {
          width: 400px; height: 400px; background: var(--lt-accent2-glow);
          bottom: -80px; left: 10%;
        }
        .lt-hero-inner {
          max-width: 1200px; margin: 0 auto; width: 100%;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 80px; align-items: center;
        }
        .lt-pill {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--lt-pill-bg); color: var(--lt-pill-text);
          border: 1px solid rgba(79,142,247,0.2);
          padding: 6px 14px; border-radius: 30px;
          font-size: 0.8rem; font-weight: 500; margin-bottom: 28px;
          letter-spacing: 0.02em;
        }
        .lt-root[data-theme="light"] .lt-pill { border-color: rgba(37,99,235,0.2); }
        .lt-pill-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--lt-accent);
          animation: lt-pulse 2s ease-in-out infinite;
        }
        @keyframes lt-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.5; transform:scale(0.7); }
        }
        .lt-h1 {
          font-family: 'Syne', sans-serif;
          font-size: clamp(2.8rem,5vw,4.2rem); font-weight: 800;
          line-height: 1.1; letter-spacing: -0.03em;
          color: var(--lt-text); margin-bottom: 24px;
        }
        .lt-h1-grad {
          background: var(--lt-btn-primary);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lt-hero-sub {
          font-size: 1.1rem; color: var(--lt-text-muted); font-weight: 300;
          line-height: 1.7; margin-bottom: 40px; max-width: 460px;
        }
        .lt-cta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .lt-stats {
          display: flex; gap: 32px; margin-top: 48px;
          padding-top: 40px; border-top: 1px solid var(--lt-border);
        }
        .lt-stat { display: flex; flex-direction: column; gap: 4px; }
        .lt-stat-num {
          font-family: 'Syne', sans-serif; font-size: 1.8rem; font-weight: 800;
          color: var(--lt-text); letter-spacing: -0.02em;
        }
        .lt-stat-label { font-size: 0.8rem; color: var(--lt-text-muted); font-weight: 400; }

        /* ── Hero Visual ── */
        .lt-hero-visual { }
        .lt-dash-card {
          background: var(--lt-card-bg); border: 1px solid var(--lt-border);
          border-radius: 16px; padding: 24px;
          box-shadow: var(--lt-shadow); transition: var(--lt-tr);
          position: relative;
        }
        .lt-db-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px;
        }
        .lt-db-title {
          font-family: 'Syne', sans-serif; font-size: 0.95rem; font-weight: 700;
          color: var(--lt-text);
        }
        .lt-db-badge {
          background: var(--lt-tag-stu); color: var(--lt-tag-stu-text);
          font-size: 0.72rem; font-weight: 500; padding: 3px 10px; border-radius: 20px;
        }
        .lt-course-list { display: flex; flex-direction: column; gap: 12px; }
        .lt-course-row {
          display: flex; align-items: center; gap: 12px; padding: 12px;
          background: var(--lt-stat-bg); border-radius: 10px;
          border: 1px solid var(--lt-border); transition: var(--lt-tr);
        }
        .lt-course-icon {
          width: 36px; height: 36px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; flex-shrink: 0;
        }
        .lt-course-meta { flex: 1; min-width: 0; }
        .lt-course-name {
          font-size: 0.82rem; font-weight: 500; color: var(--lt-text);
          margin-bottom: 4px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .lt-prog-wrap {
          height: 4px; background: var(--lt-surface);
          border-radius: 2px; overflow: hidden;
        }
        .lt-prog-fill {
          height: 100%; border-radius: 2px;
          background: var(--lt-btn-primary); transition: var(--lt-tr);
        }
        .lt-course-pct {
          font-size: 0.75rem; color: var(--lt-text-muted);
          font-weight: 500; flex-shrink: 0;
        }
        .lt-float {
          position: absolute; background: var(--lt-card-bg);
          border: 1px solid var(--lt-border); border-radius: 10px;
          padding: 7px 11px; box-shadow: var(--lt-shadow); transition: var(--lt-tr);
          display: flex; align-items: center; gap: 7px;
        }
        .lt-float1 { top: -38px; right: -36px; }
        .lt-float2 { bottom: -48px; left: -56px; }
        .lt-float-icon {
          width: 22px; height: 22px; border-radius: 6px;
          background: var(--lt-tag-stu);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.7rem;
        }
        .lt-float-text { font-size: 0.67rem; color: var(--lt-text-muted); }
        .lt-float-val  { font-size: 0.75rem; font-weight: 600; color: var(--lt-text); }

        /* ── Shared section ── */
        .lt-section { padding: 100px 5%; }
        .lt-inner { max-width: 1200px; margin: 0 auto; }
        .lt-section-label {
          font-size: 0.78rem; font-weight: 600; color: var(--lt-accent);
          letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 12px;
        }
        .lt-section-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(2rem,3.5vw,2.8rem); font-weight: 800;
          letter-spacing: -0.03em; color: var(--lt-text);
          margin-bottom: 16px; line-height: 1.2;
        }
        .lt-section-sub {
          font-size: 1rem; color: var(--lt-text-muted); font-weight: 300;
          max-width: 520px; line-height: 1.7; margin-bottom: 60px;
        }

        /* ── Why LearnTrack ── */
        .lt-why-bg {
          background: var(--lt-bg2);
          border-top: 1px solid var(--lt-border);
          border-bottom: 1px solid var(--lt-border);
        }
        .lt-why-intro {
          max-width: 640px; margin-bottom: 56px;
        }
        .lt-why-intro .lt-section-sub { margin-bottom: 0; }
        .lt-why-grid {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 24px;
        }
        .lt-why-card {
          background: var(--lt-card-bg); border: 1px solid var(--lt-border);
          border-radius: 20px; padding: 32px; transition: all 0.25s;
        }
        .lt-why-card:hover {
          border-color: var(--lt-border-strong);
          transform: translateY(-4px); box-shadow: var(--lt-shadow);
        }
        .lt-why-icon {
          width: 48px; height: 48px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem; margin-bottom: 20px;
        }
        .lt-why-title {
          font-family: 'Syne', sans-serif; font-size: 1.15rem; font-weight: 800;
          color: var(--lt-text); margin-bottom: 10px; letter-spacing: -0.02em;
        }
        .lt-why-desc {
          font-size: 0.9rem; color: var(--lt-text-muted); line-height: 1.7; font-weight: 300;
        }

        /* ── Features ── */
        .lt-features-bg {
          border-top: 1px solid var(--lt-border);
          border-bottom: 1px solid var(--lt-border);
        }
        .lt-features-grid {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 24px;
        }
        .lt-feat-card {
          background: var(--lt-card-bg); border: 1px solid var(--lt-border);
          border-radius: 16px; padding: 28px; transition: all 0.25s; cursor: default;
        }
        .lt-feat-card:hover {
          border-color: var(--lt-border-strong);
          transform: translateY(-4px); box-shadow: var(--lt-shadow);
        }
        .lt-feat-icon {
          width: 44px; height: 44px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.3rem; margin-bottom: 16px;
        }
        .lt-feat-title {
          font-family: 'Syne', sans-serif; font-size: 1.05rem; font-weight: 700;
          color: var(--lt-text); margin-bottom: 10px;
        }
        .lt-feat-desc { font-size: 0.88rem; color: var(--lt-text-muted); line-height: 1.65; font-weight: 300; }

        /* ── Roles ── */
        .lt-roles-grid {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 24px;
        }
        .lt-role-card {
          background: var(--lt-card-bg); border: 1px solid var(--lt-border);
          border-radius: 20px; padding: 32px; transition: all 0.25s;
        }
        .lt-role-card:hover {
          border-color: var(--lt-border-strong);
          transform: translateY(-4px); box-shadow: var(--lt-shadow);
        }
        .lt-role-tag {
          display: inline-block; font-size: 0.72rem; font-weight: 600;
          padding: 4px 12px; border-radius: 20px; margin-bottom: 20px;
          letter-spacing: 0.04em; text-transform: uppercase;
        }
        .lt-tag-stu  { background: var(--lt-tag-stu);  color: var(--lt-tag-stu-text); }
        .lt-tag-ins  { background: var(--lt-tag-ins);  color: var(--lt-tag-ins-text); }
        .lt-tag-adm  { background: var(--lt-tag-adm);  color: var(--lt-tag-adm-text); }
        .lt-role-title {
          font-family: 'Syne', sans-serif; font-size: 1.3rem; font-weight: 800;
          color: var(--lt-text); margin-bottom: 12px; letter-spacing: -0.02em;
        }
        .lt-role-desc {
          font-size: 0.88rem; color: var(--lt-text-muted); line-height: 1.65;
          font-weight: 300; margin-bottom: 20px;
        }
        .lt-abilities { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .lt-abilities li {
          font-size: 0.83rem; color: var(--lt-text-muted);
          display: flex; align-items: center; gap: 8px;
        }
        .lt-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }

        /* ── Analytics ── */
        .lt-stack-bg {
          background: var(--lt-bg3);
          border-top: 1px solid var(--lt-border);
          border-bottom: 1px solid var(--lt-border);
        }
        .lt-analytics-inner {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 80px; align-items: center;
        }
        .lt-analytics-list { display: flex; flex-direction: column; gap: 12px; }
        .lt-analytics-item {
          display: flex; align-items: flex-start; gap: 12px; padding: 16px;
          background: var(--lt-stat-bg); border: 1px solid var(--lt-border);
          border-radius: 12px;
        }
        .lt-ai-num {
          width: 28px; height: 28px; border-radius: 8px;
          background: var(--lt-pill-bg); color: var(--lt-pill-text);
          font-size: 0.75rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .lt-ai-text { font-size: 0.85rem; color: var(--lt-text-muted); line-height: 1.5; }
        .lt-ai-text strong { color: var(--lt-text); font-weight: 500; }
        .lt-analytics-tech-note {
          margin-top: 20px; font-size: 0.78rem; color: var(--lt-text-faint);
          font-style: italic;
        }
        .lt-chart-card {
          background: var(--lt-card-bg); border: 1px solid var(--lt-border);
          border-radius: 16px; padding: 24px; box-shadow: var(--lt-shadow);
        }
        .lt-chart-bars {
          display: flex; align-items: flex-end; gap: 8px;
          height: 120px; margin: 16px 0;
          position: relative;
        }
        .lt-bar-group {
          display: flex; gap: 3px; align-items: flex-end;
          flex: 1; height: 100%;
        }
        .lt-bar {
          flex: 1; border-radius: 4px 4px 0 0;
          transition: all 0.3s; min-width: 8px;
          align-self: flex-end;
        }
        .lt-bar-a { background: var(--lt-accent); opacity: 0.85; }
        .lt-bar-b { background: var(--lt-accent2); opacity: 0.7; }
        .lt-chart-labels { display: flex; gap: 8px; }
        .lt-chart-label { flex: 1; text-align: center; font-size: 0.68rem; color: var(--lt-text-faint); }
        .lt-legend { display: flex; gap: 16px; margin-top: 12px; }
        .lt-legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--lt-text-muted); }
        .lt-legend-dot { width: 8px; height: 8px; border-radius: 2px; }

        /* ── Stack ── */
        .lt-stack-grid {
          display: grid; grid-template-columns: repeat(5,1fr); gap: 16px;
        }
        .lt-stack-item {
          background: var(--lt-card-bg); border: 1px solid var(--lt-border);
          border-radius: 14px; padding: 24px 16px;
          text-align: center; transition: all 0.25s;
        }
        .lt-stack-item:hover {
          border-color: var(--lt-border-strong); transform: translateY(-3px);
        }
        .lt-stack-icon { font-size: 2rem; margin-bottom: 10px; }
        .lt-stack-name {
          font-family: 'Syne', sans-serif; font-size: 0.9rem; font-weight: 700;
          color: var(--lt-text); margin-bottom: 4px;
        }
        .lt-stack-layer { font-size: 0.72rem; color: var(--lt-text-faint); font-weight: 400; }

        /* ── CTA ── */
        .lt-cta-bg {
          background: var(--lt-bg2); border-top: 1px solid var(--lt-border);
        }
        .lt-cta-inner { max-width: 700px; margin: 0 auto; text-align: center; }
        .lt-cta-inner .lt-section-sub { margin: 0 auto 40px; }
        .lt-cta-btns { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }

        /* ── Footer ── */
        .lt-footer {
          background: var(--lt-bg); border-top: 1px solid var(--lt-border);
          padding: 40px 5%;
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 16px;
        }
        .lt-footer-logo {
          font-family: 'Syne', sans-serif; font-weight: 800;
          color: var(--lt-text-muted); font-size: 1rem;
        }
        .lt-footer-text { font-size: 0.8rem; color: var(--lt-text-faint); }
        .lt-footer-links { display: flex; gap: 24px; list-style: none; }
        .lt-footer-links a {
          font-size: 0.8rem; color: var(--lt-text-faint);
          text-decoration: none; transition: color 0.2s;
        }
        .lt-footer-links a:hover { color: var(--lt-text-muted); }

        /* ── Fade-in animation ── */
        .lt-fade {
          opacity: 0; transform: translateY(24px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .lt-fade.lt-visible { opacity: 1; transform: translateY(0); }
        .lt-d1 { transition-delay: 0.1s; }
        .lt-d2 { transition-delay: 0.2s; }
        .lt-d3 { transition-delay: 0.3s; }
        .lt-d4 { transition-delay: 0.4s; }
        .lt-d5 { transition-delay: 0.5s; }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .lt-hero-inner, .lt-analytics-inner { grid-template-columns: 1fr; gap: 40px; }
          .lt-features-grid, .lt-roles-grid, .lt-why-grid { grid-template-columns: 1fr; }
          .lt-stack-grid { grid-template-columns: repeat(3,1fr); }
          .lt-nav { padding: 0 4%; }
          .lt-nav-links { display: none; }
        }
      `}</style>

      <div className="lt-root" data-theme={theme}>
        {/* ── NAV ── */}
        <nav className="lt-nav">
          <a href="#" className="lt-logo">
            LearnTrack
          </a>
          <ul className="lt-nav-links">
            <li>
              <a href="#lt-why">Why LearnTrack</a>
            </li>
            <li>
              <a href="#lt-features">Features</a>
            </li>
            <li>
              <a href="#lt-roles">Roles</a>
            </li>
            <li>
              <a href="#lt-stack">Stack</a>
            </li>
          </ul>
          <div className="lt-nav-right">
            <button
              className="lt-toggle"
              onClick={toggle}
              aria-label="Toggle theme"
            >
              <span className="lt-toggle-icon lt-icon-moon">🌙</span>
              <span className="lt-toggle-icon lt-icon-sun">☀️</span>
            </button>
            <Link to="/register" className="lt-btn-nav">
              Get Started
            </Link>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section className="lt-hero">
          <div className="lt-orb lt-orb1" />
          <div className="lt-orb lt-orb2" />
          <div className="lt-hero-inner">
            <div>
              <div className="lt-pill">
                <div className="lt-pill-dot" />
                Modern Learning Platform
              </div>
              <h1 className="lt-h1">
                Learn Skills From
                <br />
                <span className="lt-h1-grad">Top Instructors.</span>
              </h1>
              <p className="lt-hero-sub">
                Explore interactive courses, track your learning progress, take
                quizzes, and grow your skills — all in one modern platform built
                for students and instructors alike.
              </p>
              <div className="lt-cta">
                <Link to="/register" className="lt-btn-primary">
                  Start Learning →
                </Link>
                <a href="#lt-why" className="lt-btn-secondary">
                  Learn More
                </a>
              </div>
              <div className="lt-stats">
                {[
                  ["3", "User Roles"],
                  ["Quizzes", "& Certificates"],
                  ["Real-time", "Progress Tracking"],
                  ["Multi-role", "Dashboards"],
                ].map(([n, l]) => (
                  <div className="lt-stat" key={l}>
                    <span className="lt-stat-num">{n}</span>
                    <span className="lt-stat-label">{l}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lt-hero-visual">
              <div className="lt-dash-card">
                <div className="lt-db-header">
                  <div className="lt-db-title">My Learning Dashboard</div>
                  <div className="lt-db-badge">● Active</div>
                </div>
                <div className="lt-course-list">
                  {[
                    {
                      icon: "🎨",
                      bg: "rgba(79,142,247,0.1)",
                      name: "UI Design Fundamentals",
                      pct: 78,
                    },
                    {
                      icon: "💻",
                      bg: "rgba(124,58,237,0.1)",
                      name: "Full-Stack Web Development",
                      pct: 54,
                    },
                    {
                      icon: "📊",
                      bg: "rgba(16,185,129,0.1)",
                      name: "Data Analysis with Python",
                      pct: 91,
                    },
                  ].map(({ icon, bg, name, pct }) => (
                    <div className="lt-course-row" key={name}>
                      <div
                        className="lt-course-icon"
                        style={{ background: bg }}
                      >
                        {icon}
                      </div>
                      <div className="lt-course-meta">
                        <div className="lt-course-name">{name}</div>
                        <div className="lt-prog-wrap">
                          <div
                            className="lt-prog-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="lt-course-pct">{pct}%</div>
                    </div>
                  ))}
                </div>
                <div className="lt-float lt-float1">
                  <div className="lt-float-icon">🏆</div>
                  <div>
                    <div className="lt-float-val">Certificate Earned</div>
                    <div className="lt-float-text">UI Design Course</div>
                  </div>
                </div>
                <div className="lt-float lt-float2">
                  <div className="lt-float-icon">📊</div>
                  <div>
                    <div className="lt-float-val">Quiz Score: 94%</div>
                    <div className="lt-float-text">Latest attempt</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── WHY LEARNTRACK ── */}
        <section className="lt-section lt-why-bg" id="lt-why">
          <div className="lt-inner">
            <div className="lt-why-intro">
              <div className="lt-section-label">Why LearnTrack</div>
              <h2 className="lt-section-title">
                Built for modern online learning.
              </h2>
              <p className="lt-section-sub">
                Whether you're a student improving your skills or an instructor
                sharing your expertise, LearnTrack makes online education
                simple, interactive, and accessible.
              </p>
            </div>
            <div className="lt-why-grid">
              {[
                {
                  bg: "rgba(79,142,247,0.12)",
                  icon: "🎯",
                  title: "Flexible Learning",
                  desc: "Learn at your own pace. Pick up where you left off, revisit lessons anytime, and fit learning around your schedule — not the other way around.",
                  delay: "",
                },
                {
                  bg: "rgba(16,185,129,0.12)",
                  icon: "📈",
                  title: "Real Progress Tracking",
                  desc: "See exactly how far you've come. Track completion, quiz scores, and watch time across every course — all in your personal dashboard.",
                  delay: "lt-d2",
                },
                {
                  bg: "rgba(124,58,237,0.12)",
                  icon: "🧑‍🏫",
                  title: "Instructor-Friendly Tools",
                  desc: "Create rich courses with videos, documents, and quizzes. Monitor how your students engage and improve your content with real data.",
                  delay: "lt-d4",
                },
              ].map(({ bg, icon, title, desc, delay }) => (
                <div className={`lt-why-card lt-fade ${delay}`} key={title}>
                  <div className="lt-why-icon" style={{ background: bg }}>
                    {icon}
                  </div>
                  <div className="lt-why-title">{title}</div>
                  <p className="lt-why-desc">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="lt-section lt-features-bg" id="lt-features">
          <div className="lt-inner">
            <div className="lt-section-label">Platform Features</div>
            <h2 className="lt-section-title">
              Everything you need to learn and teach.
            </h2>
            <p className="lt-section-sub">
              From your first lesson to your final certificate — LearnTrack has
              the tools to support every step of the journey.
            </p>
            <div className="lt-features-grid">
              {[
                {
                  bg: "rgba(79,142,247,0.1)",
                  icon: "🔐",
                  title: "Secure Accounts",
                  desc: "Your data and progress stay protected with secure authentication. Every account is isolated — students only see their own data, always.",
                  delay: "",
                },
                {
                  bg: "rgba(124,58,237,0.1)",
                  icon: "📖",
                  title: "Interactive Courses",
                  desc: "Watch video lessons, read documents, and complete quizzes — all in one seamless experience. No jumping between different tools.",
                  delay: "lt-d1",
                },
                {
                  bg: "rgba(16,185,129,0.1)",
                  icon: "🧠",
                  title: "Quiz Engine",
                  desc: "Test your knowledge with multiple-choice and true/false quizzes. Retake them as many times as you need, with full score history saved.",
                  delay: "lt-d2",
                },
                {
                  bg: "rgba(245,158,11,0.1)",
                  icon: "📈",
                  title: "Smart Analytics",
                  desc: "Understand how students engage with your content. Track watch time, completion rates, and quiz performance — all refreshed automatically.",
                  delay: "lt-d3",
                },
                {
                  bg: "rgba(239,68,68,0.1)",
                  icon: "⚡",
                  title: "Activity Tracking",
                  desc: "Every play, pause, and skip is recorded. Instructors can see which lessons lose attention and students can pick up right where they left off.",
                  delay: "lt-d4",
                },
                {
                  bg: "rgba(20,184,166,0.1)",
                  icon: "🎓",
                  title: "Certificates & Progress",
                  desc: "Earn certificates on course completion. Your progress is always visible — motivating you to keep going from first lesson to last.",
                  delay: "lt-d5",
                },
              ].map(({ bg, icon, title, desc, delay }) => (
                <div className={`lt-feat-card lt-fade ${delay}`} key={title}>
                  <div className="lt-feat-icon" style={{ background: bg }}>
                    {icon}
                  </div>
                  <div className="lt-feat-title">{title}</div>
                  <div className="lt-feat-desc">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ROLES ── */}
        <section className="lt-section" id="lt-roles">
          <div className="lt-inner">
            <div className="lt-section-label">User Roles</div>
            <h2 className="lt-section-title">
              One platform, three experiences.
            </h2>
            <p className="lt-section-sub">
              Whether you're here to learn, teach, or manage — LearnTrack gives
              you the right tools for your role.
            </p>
            <div className="lt-roles-grid">
              {[
                {
                  tag: "lt-tag-stu",
                  tagLabel: "Student",
                  dotColor: "var(--lt-tag-stu-text)",
                  title: "Learn & Grow",
                  desc: "Browse the course catalogue, enroll in what interests you, and track your journey from first lesson to final certificate.",
                  abilities: [
                    "Browse & enroll in courses",
                    "Watch lessons & read materials",
                    "Take quizzes & track scores",
                    "Monitor progress & earn certs",
                  ],
                  delay: "",
                },
                {
                  tag: "lt-tag-ins",
                  tagLabel: "Instructor",
                  dotColor: "var(--lt-tag-ins-text)",
                  title: "Teach & Inspire",
                  desc: "Create engaging courses, upload content, and understand how your students are progressing with detailed learner insights.",
                  abilities: [
                    "Create & manage courses",
                    "Upload videos, docs & quizzes",
                    "Monitor student engagement",
                    "View course analytics",
                  ],
                  delay: "lt-d2",
                },
                {
                  tag: "lt-tag-adm",
                  tagLabel: "Admin",
                  dotColor: "var(--lt-tag-adm-text)",
                  title: "Control Everything",
                  desc: "Full platform visibility. Manage users, oversee all courses, and keep the platform running smoothly for everyone.",
                  abilities: [
                    "Manage all users & roles",
                    "Oversee every course",
                    "Access platform-wide analytics",
                    "Full instructor capabilities",
                  ],
                  delay: "lt-d4",
                },
              ].map(
                ({
                  tag,
                  tagLabel,
                  dotColor,
                  title,
                  desc,
                  abilities,
                  delay,
                }) => (
                  <div className={`lt-role-card lt-fade ${delay}`} key={title}>
                    <span className={`lt-role-tag ${tag}`}>{tagLabel}</span>
                    <div className="lt-role-title">{title}</div>
                    <p className="lt-role-desc">{desc}</p>
                    <ul className="lt-abilities">
                      {abilities.map((a) => (
                        <li key={a}>
                          <div
                            className="lt-dot"
                            style={{ background: dotColor }}
                          />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        {/* ── ANALYTICS ── */}
        <section className="lt-section lt-stack-bg" id="lt-analytics">
          <div className="lt-inner">
            <div className="lt-analytics-inner">
              <div>
                <div className="lt-section-label">Analytics</div>
                <h2 className="lt-section-title">
                  Insights that help students succeed.
                </h2>
                <p className="lt-section-sub" style={{ marginBottom: 32 }}>
                  Track engagement, quiz performance, and learning progress with
                  powerful analytics — built for both students and instructors.
                </p>
                <div className="lt-analytics-list">
                  {[
                    [
                      "01",
                      "Overall Performance",
                      "Watch time, quiz scores, and course completion at a glance.",
                      "",
                    ],
                    [
                      "02",
                      "Student Engagement",
                      "See who's actively learning and when they were last on the platform.",
                      "lt-d1",
                    ],
                    [
                      "03",
                      "Struggling Learners",
                      "Identify students who may need extra support before they fall behind.",
                      "lt-d2",
                    ],
                    [
                      "04",
                      "Content Effectiveness",
                      "Discover which lessons lose attention so instructors can improve them.",
                      "lt-d3",
                    ],
                    [
                      "05",
                      "Completion Rates",
                      "Track how many students finish each course and where they tend to drop off.",
                      "lt-d4",
                    ],
                  ].map(([num, label, text, delay]) => (
                    <div
                      className={`lt-analytics-item lt-fade ${delay}`}
                      key={num}
                    >
                      <div className="lt-ai-num">{num}</div>
                      <div className="lt-ai-text">
                        <strong>{label}</strong> — {text}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="lt-analytics-tech-note">
                  Powered by optimized PostgreSQL analytics pipelines, refreshed
                  automatically.
                </p>
              </div>
              <div className="lt-fade lt-d2">
                <div className="lt-chart-card">
                  <div className="lt-db-header">
                    <div className="lt-db-title">Weekly Performance</div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--lt-text-faint)",
                      }}
                    >
                      Last 6 weeks
                    </div>
                  </div>
                  <div className="lt-chart-bars">
                    {[
                      [60, 45],
                      [75, 60],
                      [55, 80],
                      [85, 70],
                      [70, 90],
                      [95, 85],
                    ].map(([a, b], i) => (
                      <div className="lt-bar-group" key={i}>
                        <div
                          className="lt-bar lt-bar-a"
                          style={{ height: `${a * 1.2}px` }}
                        />
                        <div
                          className="lt-bar lt-bar-b"
                          style={{ height: `${b * 1.2}px` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="lt-chart-labels">
                    {["W1", "W2", "W3", "W4", "W5", "W6"].map((w) => (
                      <div className="lt-chart-label" key={w}>
                        {w}
                      </div>
                    ))}
                  </div>
                  <div className="lt-legend">
                    <div className="lt-legend-item">
                      <div
                        className="lt-legend-dot"
                        style={{ background: "var(--lt-accent)" }}
                      />
                      Watch time
                    </div>
                    <div className="lt-legend-item">
                      <div
                        className="lt-legend-dot"
                        style={{ background: "var(--lt-accent2)" }}
                      />
                      Quiz scores
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── STACK ── */}
        <section className="lt-section" id="lt-stack">
          <div className="lt-inner">
            <div className="lt-section-label">Technology Stack</div>
            <h2 className="lt-section-title">Built with the right tools.</h2>
            <p className="lt-section-sub">
              A modern, production-ready stack chosen for reliability, developer
              experience, and scalability.
            </p>
            <div className="lt-stack-grid">
              {[
                {
                  icon: "🐘",
                  name: "PostgreSQL",
                  layer: "Database",
                  delay: "",
                },
                {
                  icon: "⚡",
                  name: "Supabase",
                  layer: "Auth + Hosting",
                  delay: "lt-d1",
                },
                {
                  icon: "🟩",
                  name: "Node.js",
                  layer: "Backend Runtime",
                  delay: "lt-d2",
                },
                {
                  icon: "⚛️",
                  name: "React + Vite",
                  layer: "Frontend",
                  delay: "lt-d3",
                },
                {
                  icon: "🎨",
                  name: "Tailwind CSS",
                  layer: "Styling",
                  delay: "lt-d4",
                },
              ].map(({ icon, name, layer, delay }) => (
                <div className={`lt-stack-item lt-fade ${delay}`} key={name}>
                  <div className="lt-stack-icon">{icon}</div>
                  <div className="lt-stack-name">{name}</div>
                  <div className="lt-stack-layer">{layer}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="lt-section lt-cta-bg">
          <div className="lt-inner">
            <div className="lt-cta-inner">
              <div className="lt-section-label">Get Started</div>
              <h2 className="lt-section-title">Ready to start learning?</h2>
              <p className="lt-section-sub">
                Join LearnTrack and experience a platform where students grow,
                instructors thrive, and learning actually sticks.
              </p>
              <div className="lt-cta-btns">
                <Link to="/register" className="lt-btn-primary">
                  Create an Account
                </Link>
                <a href="#lt-why" className="lt-btn-secondary">
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="lt-footer">
          <div className="lt-footer-logo">LearnTrack</div>
          <div className="lt-footer-text">
            DBMS Course Project · 2026 · Personal Reference
          </div>
          <ul className="lt-footer-links">
            <li>
              <a href="#lt-features">Features</a>
            </li>
            <li>
              <a href="#lt-stack">Stack</a>
            </li>
            <li>
              <a href="#lt-analytics">Analytics</a>
            </li>
          </ul>
        </footer>
      </div>
    </>
  );
}
