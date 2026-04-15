import { useEffect, useState } from "react";
import api from "../api/client";
import AlertModal from "./AlertModal";
import ConfirmModal from "./ConfirmModal";

type Lesson = {
  lesson_id: number;
  lesson_number: number;
  lesson_date: string;
  status?: "scheduled" | "attended" | "leave" | "teacher_leave" | "remark" | "paid_until_here";
  is_first: boolean;
  is_manual_override?: boolean;
  is_makeup?: boolean;
  remark?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  lesson: Lesson | null;
  onSaved?: () => void;
};

export default function EditLessonModal({
  open,
  onClose,
  lesson,
  onSaved,
}: Props) {
  const [date, setDate] = useState("");
  const [isManual, setIsManual] = useState(false);
  const [status, setStatus] = useState<"scheduled" | "attended" | "leave" | "teacher_leave" | "remark" | "paid_until_here">(
    "scheduled"
  );
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  // 🔔 Alert modal
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");

  // ❗ Delete confirmation
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (lesson) {
      setDate(lesson.lesson_date ?? "");
      setIsManual(!!lesson.is_manual_override);
      setStatus(lesson.status ?? "scheduled");
      setRemark(lesson.remark ?? "");
      setSaving(false);
    }
  }, [lesson]);

  if (!open || !lesson) return null;

  const save = async () => {
    setSaving(true);
    try {
      // 1️⃣ Update date (ONLY meaningful for make-up)
      await api.patch(`/lessons/${lesson.lesson_id}`, {
        lesson_date: date,
        is_manual_override: lesson.is_makeup ? true : isManual,
      });

      // 2️⃣ Status only for normal lessons
      if (!lesson.is_makeup) {
        await api.patch(`/lessons/${lesson.lesson_id}/status`, {
          status,
          remark: status === "remark" ? remark : null
        });
      }

      onSaved?.();
      onClose();
    } catch (err: any) {
      setAlertMsg(
        err?.response?.data?.detail || "Something went wrong"
      );
      setAlertOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const deleteMakeup = async () => {
    try {
      await api.delete(`/lessons/${lesson.lesson_id}`);
      onSaved?.();
      onClose();
    } catch (err: any) {
      setAlertMsg(
        err?.response?.data?.detail || "Delete failed"
      );
      setAlertOpen(true);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white p-4 rounded w-[420px] max-w-full">
          <h3 className="text-lg font-semibold mb-3">
            Edit Lesson #{lesson.lesson_number}
          </h3>

          {/* Date */}
          <label className="text-sm block mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="p-2 border w-full mb-3"
          />

          {/* Manual override – normal lessons only */}
          {!lesson.is_makeup && (
            <label className="inline-flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={isManual}
                onChange={(e) => setIsManual(e.target.checked)}
              />
              <span className="text-sm">
                Manual override (preserve on regenerate)
              </span>
            </label>
          )}

  // Status – normal lessons only
          {!lesson.is_makeup && (
            <>
              <label className="text-sm block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "scheduled" | "attended" | "leave" | "teacher_leave" | "remark" | "paid_until_here")
                }
                className="border p-2 rounded w-full mb-3"
              >
                <option value="scheduled">Scheduled</option>
                <option value="attended">Attended</option>
                <option value="leave">Leave</option>
                <option value="teacher_leave">Teacher Leave</option>
                <option value="remark">Remark</option>
                <option value="paid_until_here">Paid until here</option>
              </select>

              {status === "remark" && (
                <>
                  <label className="text-sm block mb-1">Remark Comment (max 20 words)</label>
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    className="border p-2 rounded w-full h-20 mb-3"
                    placeholder="Enter remark..."
                    maxLength={200}
                  />
                </>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-3 py-2 border rounded"
            >
              Cancel
            </button>

            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-2 bg-green-600 text-white rounded"
            >
              {saving ? "Saving..." : "Save"}
            </button>

            {lesson.is_makeup && (
              <button
                onClick={() => setConfirmDeleteOpen(true)}
                className="ml-4 px-3 py-2 bg-red-600 text-white rounded"
              >
                Delete Make-up
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ⚠️ Alert popup */}
      <AlertModal
        open={alertOpen}
        message={alertMsg}
        onClose={() => setAlertOpen(false)}
      />

      {/* ❗ Delete confirmation */}
      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete Make-up Lesson?"
        message="Are you sure you want to delete this make-up lesson? This action cannot be undone."
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          deleteMakeup();
        }}
      />
    </>
  );
}
