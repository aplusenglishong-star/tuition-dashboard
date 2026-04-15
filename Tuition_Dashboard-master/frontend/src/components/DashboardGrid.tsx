// frontend/src/components/DashboardGrid.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import CreateStudentForm from "./CreateStudentForm";
import EditStudentModal from "./EditStudentModal";
import EditLessonModal from "./EditLessonModal";
import RegeneratePreviewModal from "./RegeneratePreviewModal";
import React from "react";
import AddMakeupModal from "./AddMakeupModal";


type Lesson = {
  lesson_id: number;
  lesson_number: number;
  lesson_date: string;
  is_first: boolean;
  is_manual_override?: boolean;
  status?: "scheduled" | "attended" | "leave" | "teacher_leave" | "remark" | "paid_until_here";
  is_makeup?: boolean;
  remark?: string;
};

type PackageType = {
  package_id: number;
  package_size: number;
  payment_status: boolean;
  first_lesson_date?: string | null;
  lessons?: Lesson[];
};

type StudentType = {
  student_id: number;
  name: string;
  cefr?: string;
  group_name?: string;
  lesson_day_1: number;
  lesson_day_2?: number | null;
  package_size: number;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
  packages?: PackageType[];
};

function ConfirmModal({
  open,
  title,
  message,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[420px]">
        <h2 className="text-xl font-semibold mb-3">{title}</h2>
        <p className="mb-6 text-gray-700">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [students, setStudents] = useState<StudentType[]>([]);

  // Modals / editing
  const [editingStudent, setEditingStudent] = useState<StudentType | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonModalOpen, setLessonModalOpen] = useState(false);

  const [previewPkgId, setPreviewPkgId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCurrentLessons, setPreviewCurrentLessons] = useState<Lesson[]>([]);

  // Delete student modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentType | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [packageToDelete, setPackageToDelete] = useState<PackageType | null>(null);

  // Filters
  const [tab, setTab] = useState<"all" | "4" | "8">("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [dayFilter, setDayFilter] = useState<string>("all");

  const [futurePreviewMap, setFuturePreviewMap] = useState<Record<number, any[]>>({});
  const [showFutureMap, setShowFutureMap] = useState<Record<number, boolean>>({});

  const [creatingPkg, setCreatingPkg] = useState<number | null>(null);

  const [makeupPkgId, setMakeupPkgId] = useState<number | null>(null);
  const [makeupOpen, setMakeupOpen] = useState(false);
  const [, setLoading] = useState(false);
  const [, setLoadingFuture] = useState<Record<number, boolean>>({});


  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/students/");
      setStudents(res.data || []);
    } catch (err) {
      console.error("Failed to load students", err);
      alert("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // compute groups list
  const groups = useMemo(() => {
    const setGroups = new Set<string>();
    for (const s of students) if (s.group_name) setGroups.add(s.group_name);
    return Array.from(setGroups).sort();
  }, [students]);

  const dayLabel = (n: number) =>
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][n] ?? `${n}`;

  const studentMatchesFilters = (s: StudentType) => {
    if (groupFilter !== "all" && s.group_name !== groupFilter) return false;

    if (dayFilter !== "all") {
      const dayNum = Number(dayFilter);
      const d1 = Number(s.lesson_day_1);
      const d2 =
        s.lesson_day_2 !== null && s.lesson_day_2 !== undefined
          ? Number(s.lesson_day_2)
          : null;
      if (d1 !== dayNum && d2 !== dayNum) return false;
    }
    return true;
  };

  // Build flat rows (one row per package). Keep order stable: students by name, packages by first_lesson_date
  const rows = useMemo(() => {
    const flat: Array<{ key: string; student: StudentType; pkg: PackageType | null; isFirstForStudent: boolean, isOriginalPackage?: boolean; }> = [];

    const filtered = students.filter(s => {
      // student-level filters
      return studentMatchesFilters(s);
    });

    // order students by name
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    for (const s of filtered) {
      const pkgs = Array.isArray(s.packages) ? s.packages : [];
      if (pkgs.length === 0) {
        flat.push({
          key: `s-${s.student_id}-nopkg`,
          student: s,
          pkg: null,
          isFirstForStudent: true,
          isOriginalPackage: true,
        });
        continue;
      }

      pkgs.forEach((pkg, idx) => {
        const sz = Number(pkg.package_size);
        if (tab === "4" && sz !== 4) return;
        if (tab === "8" && sz !== 8) return;

        flat.push({
          key: `s-${s.student_id}-p-${pkg.package_id}`,
          student: s,
          pkg,
          isFirstForStudent: idx === 0,
          isOriginalPackage: idx === 0,
        });
      });

    }

    return flat;
  }, [students, tab, groupFilter, dayFilter]);

  // Actions
  const togglePayment = async (pkgId: number, paid: boolean) => {
    try {
      const url = paid
        ? `/students/packages/${pkgId}/mark_paid`
        : `/students/packages/${pkgId}/mark_unpaid`;
      await api.post(url);
      await load();
    } catch (err) {
      console.error("togglePayment error", err);
      alert("Toggle payment failed");
    }
  };

  const createChunk = async (
    pkg: PackageType,
    chunk: any[],
    markPaid = false
  ) => {
    try {
      setCreatingPkg(pkg.package_id);

      await api.post(
        `/students/packages/${pkg.package_id}/create_from_preview?mark_paid=${markPaid}`,
        {
          lesson_dates: chunk.map(c => c.lesson_date),
        }
      );

      // hide future preview for this package
      setShowFutureMap(prev => ({
        ...prev,
        [pkg.package_id]: false,
      }));

      await load(); // reload dashboard
    } catch (err: any) {
      console.error("create chunk failed", err);
      alert(
        "Failed to create package: " +
        (err?.response?.data?.detail || err.message)
      );
    } finally {
      setCreatingPkg(null);
    }
  };


  const openPreview = (pkg: PackageType | null) => {
    if (!pkg) return;
    const current = (pkg.lessons ?? []).map((l: any) => ({
      lesson_number: l.lesson_number,
      lesson_date: l.lesson_date,
      is_manual_override: l.is_manual_override,
      is_first: l.is_first,
    }));

    setPreviewCurrentLessons(current as Lesson[]);
    setPreviewPkgId(pkg.package_id);
    setPreviewOpen(true);
  };

  const exportExcel = async () => {
    try {
      const params = new URLSearchParams();
      params.append("tab", tab);

      if (groupFilter !== "all") params.append("group", groupFilter);
      if (dayFilter !== "all") params.append("day", dayFilter);

      const url = `/export/dashboard.xlsx?${params.toString()}`;
      const res = await api.get(url, { responseType: "blob" });

      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = blobUrl;

      const fileSuffix =
        tab === "4" ? "4-lesson" : tab === "8" ? "8-lesson" : "all";

      a.download = `tuition_dashboard_${fileSuffix}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("Export failed", err);
      alert("Export failed: " + (err?.response?.data?.detail || err.message));
    }
  };

  // find first lesson date in chunk
  const firstDateOfChunk = (chunk: any[]) => {
    for (const item of chunk) {
      if (item?.lesson_date) return item.lesson_date;
    }
    return null;
  };

  const deletePackageConfirmed = async () => {
    if (!packageToDelete) return;
    try {
      await api.delete(`/students/packages/${packageToDelete.package_id}`);
      await load();
    } catch (err: any) {
      console.error("Delete package failed", err);
      alert("Delete failed: " + (err?.response?.data?.detail || err.message));
    } finally {
      setPackageToDelete(null);
    }
  };

  // Delete student flow (modal)
  const deleteStudentConfirmed = async () => {
    if (!studentToDelete) return;
    const sid = studentToDelete.student_id;
    try {
      setDeletingId(sid);
      await api.delete(`/students/${sid}`);
      await load();
    } catch (err: any) {
      console.error("Delete student failed", err);
      alert("Delete failed: " + (err?.response?.data?.detail || err?.message || ""));
    } finally {
      setDeletingId(null);
      setConfirmOpen(false);
      setStudentToDelete(null);
    }
  };

  const fetchAndToggleFuture = async (pkg: any) => {
    if (!pkg) return;
    const id = pkg.package_id;
    // if already shown -> hide
    if (showFutureMap[id]) {
      setShowFutureMap(prev => ({ ...prev, [id]: false }));
      return;
    }
    // if already fetched -> show
    if (futurePreviewMap[id]) {
      setShowFutureMap(prev => ({ ...prev, [id]: true }));
      return;
    }

    try {
      setLoadingFuture(prev => ({ ...prev, [id]: true }));
      // REQUEST extend=true so backend returns multiple package-sized blocks up to student's end_date
      const res = await api.get(`/students/packages/${id}/regenerate?preview=true&extend=true`);
      const proposed: any[] = res.data?.proposed_lessons ?? [];

      // Ensure ordered by lesson_date (ISO strings)
      const ordered = proposed.slice().sort((a: any, b: any) => {
        const da = a.lesson_date ?? "";
        const db = b.lesson_date ?? "";
        return da.localeCompare(db);
      });

      // chunk into blocks of package_size
      const chunkSize = Number(pkg.package_size) || 4;
      const chunks: any[][] = [];
      for (let i = 0; i < ordered.length; i += chunkSize) {
        chunks.push(ordered.slice(i, i + chunkSize));
      }

      setFuturePreviewMap(prev => ({ ...prev, [id]: chunks }));
      setShowFutureMap(prev => ({ ...prev, [id]: true }));
    } catch (err) {
      console.error("Failed to fetch future preview", err);
      alert("Failed to load future weeks preview");
    } finally {
      setLoadingFuture(prev => ({ ...prev, [id]: false }));
    }
  };

  // helper to render lesson map for a package
  const lessonMapFor = (lessons: Lesson[]) => {
    const map: Record<number, Lesson | undefined> = {};
    for (const l of lessons) {
      map[Number(l.lesson_number)] = l;
    }
    return map;
  };


  // UI
  const maxCols = tab === "4" ? 4 : tab === "8" ? 8 : 8;

  return (
    <div className="p-6">
      {/* Back Button */}
      <div className="mb-4">
        <button
          onClick={() => (window.location.href = "/")}
          className="text-blue-600 hover:text-blue-800 transition-transform duration-200 hover:-translate-x-1"
        >
          <span className="text-4xl">←</span>
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Tuition Dashboard</h1>

        <button
          onClick={exportExcel}
          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 hover:scale-[1.03] transition-all"
        >
          Export Excel
        </button>
      </div>

      <CreateStudentForm onCreated={load} />

      {/* Filters */}
      <div className="mt-4 mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-50 rounded p-1">
            <button
              onClick={() => setTab("all")}
              className={`px-3 py-1 rounded ${tab === "all" ? "bg-white shadow" : "text-gray-600"}`}
            >
              All
            </button>
            <button
              onClick={() => setTab("4")}
              className={`px-3 py-1 rounded ${tab === "4" ? "bg-white shadow" : "text-gray-600"}`}
            >
              4-lesson
            </button>
            <button
              onClick={() => setTab("8")}
              className={`px-3 py-1 rounded ${tab === "8" ? "bg-white shadow" : "text-gray-600"}`}
            >
              8-lesson
            </button>
          </div>

          <div className="ml-4">
            <label className="text-xs block mb-1">Group</label>
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="p-2 border rounded">
              <option value="all">All groups</option>
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="ml-4">
            <label className="text-xs block mb-1">Day</label>
            <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} className="p-2 border rounded">
              <option value="all">All days</option>
              <option value="0">Mon</option>
              <option value="1">Tue</option>
              <option value="2">Wed</option>
              <option value="3">Thu</option>
              <option value="4">Fri</option>
              <option value="5">Sat</option>
              <option value="6">Sun</option>
            </select>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          Showing {rows.length} rows • Students: {students.length}
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-auto bg-white border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2">Name</th>
              <th className="border px-2">CEFR</th>
              <th className="border px-2">Group</th>
              <th className="border px-2">Lesson Days</th>
              <th className="border px-2">Package</th>

              {Array.from({ length: maxCols }).map((_, i) => (
                <th key={i} className="border px-2">{i + 1}</th>
              ))}

              <th className="border px-2">Paid</th>
              <th className="border px-2">Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const s = row.student;
              const pkg = row.pkg;
              const sid = s.student_id;
              const regularLessons = (pkg?.lessons ?? []).filter(l => !l.is_makeup);
              const makeupLessons = (pkg?.lessons ?? []).filter(l => l.is_makeup);
              const lessonsMap = lessonMapFor(regularLessons);


              return (
                <React.Fragment key={row.key}>
                  {/* Main package row */}
                  <tr>
                    <td className="border px-2">{row.isFirstForStudent ? s?.name : ""}</td>
                    <td className="border px-2">{row.isFirstForStudent ? s?.cefr : ""}</td>
                    <td className="border px-2">{row.isFirstForStudent ? s?.group_name : ""}</td>
                    <td className="border px-2">
                      {row.isFirstForStudent
                        ? s?.lesson_day_2 !== null && s?.lesson_day_2 !== undefined
                          ? `${dayLabel(s.lesson_day_1)}, ${dayLabel(s.lesson_day_2)}`
                          : `${dayLabel(s.lesson_day_1)}`
                        : ""}
                    </td>

                    {/* PACKAGE: show only size (4 or 8) */}
                    <td className="border px-2 text-center">
                      {row.isFirstForStudent && pkg ? pkg.package_size : ""}
                    </td>

                    {/* Lessons columns */}
                    {Array.from({ length: maxCols }).map((_, idx) => {
                      const lesson = lessonsMap[idx + 1];
                      const dateStr = lesson ? (lesson.lesson_date ?? "") : "";
                      const isFirst = lesson ? !!lesson.is_first : false;
                      const color = isFirst && pkg && !pkg.payment_status ? "text-red-600 font-semibold" : "";

                      return (
                        <td
                          key={`main-${row.key}-c-${idx}`}
                          className={`border px-2 ${lesson ? "cursor-pointer" : ""} ${color}`}
                          onClick={() => {
                            if (lesson) {
                              setEditingLesson(lesson);
                              setLessonModalOpen(true);
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            {/* Date */}
                            <span>{dateStr}</span>

                            {/* Attended */}
                            {lesson?.status === "attended" && (
                              <span title="Attended" className="text-green-600 font-semibold">
                                ✓
                              </span>
                            )}

                            {/* Leave */}
                            {lesson?.status === "leave" && (
                              <span
                                title="Student on leave"
                                className="text-xs px-1 rounded bg-red-100 text-red-700 border"
                              >
                                L
                              </span>
                            )}

                            {/* Teacher Leave */}
                            {lesson?.status === "teacher_leave" && (
                              <span
                                title="Teacher on leave"
                                className="text-xs px-1 rounded bg-red-100 text-red-700 border"
                              >
                                TL
                              </span>
                            )}

                            {/* Remark */}
                            {lesson?.status === "remark" && (
                              <span
                                title={lesson.remark || "Remark"}
                                className="text-xs px-1 rounded bg-green-100 text-green-700 border"
                              >
                                R
                              </span>
                            )}

                            {/* Paid until here */}
                            {lesson?.status === "paid_until_here" && (
                              <span
                                title="Paid until here"
                                className="text-xs px-1 rounded bg-blue-100 text-blue-700 border"
                              >
                                PH
                              </span>
                            )}

                            {/* Make-up */}
                            {lesson?.is_makeup && (
                              <span
                                title="Make-up lesson"
                                className="text-xs px-1 rounded bg-purple-100 text-purple-700 border"
                              >
                                M
                              </span>
                            )}
                          </div>
                        </td>

                      );
                    })}

                    <td className="border px-2">{pkg ? (pkg.payment_status ? "Paid" : "Unpaid") : ""}</td>

                    <td className="border px-2 space-x-2">
                      {pkg && (
                        <>
                          {/* Always allowed */}
                          <button
                            onClick={() => togglePayment(pkg.package_id, !pkg.payment_status)}
                            className="px-2 py-1 text-sm bg-indigo-600 text-white rounded"
                          >
                            {pkg.payment_status ? "Mark Unpaid" : "Mark Paid"}
                          </button>

                          <button
                            onClick={() => openPreview(pkg)}
                            className="px-2 py-1 text-sm border rounded"
                          >
                            Regenerate
                          </button>

                          <button
                            onClick={() => {
                              setMakeupPkgId(pkg.package_id);
                              setMakeupOpen(true);
                            }}
                            className="px-2 py-1 text-sm bg-purple-600 text-white rounded"
                          >
                            Add Make-up
                          </button>

                          <button
                            onClick={() => fetchAndToggleFuture(pkg)}
                            className="px-2 py-1 text-sm border rounded"
                          >
                            {showFutureMap[pkg.package_id] ? "Hide Future" : "Show Future"}
                          </button>

                          {/* 🔴 DELETE PACKAGE — ONLY FOR FUTURE-CREATED */}
                          {!row.isOriginalPackage && (
                            <button
                              onClick={() => setPackageToDelete(pkg)}
                              className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Delete Package
                            </button>
                          )}
                        </>
                      )}

                      {row.isFirstForStudent && (
                        <>
                          <button
                            onClick={() => { setEditingStudent(s); setEditOpen(true); }}
                            disabled={deletingId === sid}
                            className="px-2 py-1 text-sm border rounded hover:bg-blue-50"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => { setStudentToDelete(s); setConfirmOpen(true); }}
                            disabled={deletingId === sid}
                            className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            {deletingId === sid ? "Deleting..." : "Delete"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {/* 🟣 MAKE-UP ROW */}
                  {makeupLessons.length > 0 && (
                    <tr className="bg-purple-50">
                      <td className="border px-2"></td>
                      <td className="border px-2"></td>
                      <td className="border px-2"></td>
                      <td className="border px-2"></td>

                      {/* Label column */}
                      <td className="border px-2 text-center font-semibold text-purple-700">
                        MU
                      </td>

                      {/* Lesson cells */}
                      {Array.from({ length: maxCols }).map((_, idx) => {
                        const lesson = makeupLessons[idx];
                        return (
                          <td key={idx} className="border px-2 text-sm">
                            {lesson && (
                              <div
                                className="flex items-center gap-1 cursor-pointer"
                                onClick={() => {
                                  setEditingLesson(lesson);
                                  setLessonModalOpen(true);
                                }}
                              >
                                <span>{lesson.lesson_date}</span>

                                {lesson.status === "attended" && (
                                  <span className="text-green-600 font-semibold">✓</span>
                                )}

                                {lesson.status === "leave" && (
                                  <span className="text-xs px-1 rounded bg-red-100 text-red-700 border">
                                    L
                                  </span>
                                )}

                                <span className="text-xs px-1 rounded bg-purple-200 text-purple-800 border">
                                  M
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Paid column */}
                      <td className="border px-2"></td>

                      {/* Actions column */}
                      <td className="border px-2"></td>
                    </tr>
                  )}


                  {/* Preview / future chunks (render immediately after the main row) */}
                  {row.pkg && showFutureMap[row.pkg.package_id] && futurePreviewMap[row.pkg.package_id] && (
                    futurePreviewMap[row.pkg.package_id].map((chunk: any[], chunkIdx: number) => {
                      const firstDate = firstDateOfChunk(chunk);

                      return (
                        <tr key={`${row.key}-future-${chunkIdx}`} className="bg-yellow-50">
                          <td className="border px-2"></td>
                          <td className="border px-2"></td>
                          <td className="border px-2"></td>
                          <td className="border px-2"></td>

                          {/* PACKAGE: show only size */}
                          <td className="border px-2 text-center">
                            {row.pkg?.package_size}
                          </td>

                          {/* Lessons (single rendering) */}
                          {Array.from({ length: maxCols }).map((_, idx) => {
                            const lesson = chunk[idx];
                            const date = lesson ? (lesson.lesson_date ?? "") : "";
                            const isManual = lesson ? !!lesson.is_manual_override : false;
                            return (
                              <td key={`future-${row.key}-${chunkIdx}-c-${idx}`} className="border px-2 text-sm text-gray-700">
                                <div className="flex items-center justify-between">
                                  <div>{date}</div>
                                  {isManual && <div className="ml-2 text-xs px-1 py-[2px] rounded bg-yellow-100 text-yellow-800 border">M</div>}
                                </div>
                              </td>
                            );
                          })}

                          {/* Paid column empty */}
                          <td className="border px-2"></td>

                          {/* ACTIONS for preview chunk */}
                          <td className="border px-2 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                              {firstDate && (
                                <button
                                  disabled={creatingPkg === row.pkg!.package_id}
                                  onClick={async () => {
                                    setCreatingPkg(row.pkg!.package_id);
                                    await createChunk(row.pkg!, chunk, false);
                                    setCreatingPkg(null);
                                  }}
                                  className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                                >
                                  Create
                                </button>
                              )}
                            </div>
                            {/* show the first date as a small hint on wide screens */}
                            <div className="hidden sm:block text-xs text-gray-600 mt-1">{firstDate ?? ""}</div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit student modal */}
      <EditStudentModal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditingStudent(null);
        }}
        student={editingStudent}
        onSaved={() => load()}
      />

      {/* Edit lesson modal */}
      <EditLessonModal
        open={lessonModalOpen}
        onClose={() => {
          setLessonModalOpen(false);
          setEditingLesson(null);
        }}
        lesson={editingLesson}
        onSaved={() => load()}
      />

      {/* Regenerate preview modal */}
      <RegeneratePreviewModal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewPkgId(null);
          setPreviewCurrentLessons([]);
        }}
        packageId={previewPkgId}
        currentLessons={previewCurrentLessons}
        onCommitted={() => load()}
      />

      <AddMakeupModal
        open={makeupOpen}
        packageId={makeupPkgId}
        onClose={() => {
          setMakeupOpen(false);
          setMakeupPkgId(null);
        }}
        onSaved={() => load()}
      />

      {/* Delete student confirm modal */}
      <ConfirmModal
        open={confirmOpen}
        title="Delete Student?"
        message={`Are you sure you want to delete "${studentToDelete?.name}"? This action cannot be undone.`}
        onCancel={() => {
          setConfirmOpen(false);
          setStudentToDelete(null);
        }}
        onConfirm={deleteStudentConfirmed}
      />

      <ConfirmModal
        open={!!packageToDelete}
        title="Delete Package?"
        message="Are you sure you want to delete this package? This action cannot be undone."
        onCancel={() => setPackageToDelete(null)}
        onConfirm={deletePackageConfirmed}
      />
    </div>
  );
}
