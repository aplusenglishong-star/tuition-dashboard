import { useState } from "react";
import api from "../api/client";

type Props = {
  open: boolean;
  onClose: () => void;
  packageId: number | null;
  onSaved?: () => void;
};

export default function AddMakeupModal({
  open,
  onClose,
  packageId,
  onSaved,
}: Props) {
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open || !packageId) return null;

  const submit = async () => {
    if (!date) {
      alert("Please select a date");
      return;
    }

    setSaving(true);
    try {
      await api.post(
        `/students/packages/${packageId}/add_makeup`,
        { lesson_date: date }
      );
      onSaved?.();
      onClose();
    } catch (err: any) {
      alert(
        err?.response?.data?.detail ||
        "Failed to add make-up lesson"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white p-5 rounded w-[380px]">
        <h3 className="text-lg font-semibold mb-3">
          Add Make-up Lesson
        </h3>

        <label className="text-sm block mb-1">Lesson date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border p-2 w-full mb-4"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-2 border rounded"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-3 py-2 bg-purple-600 text-white rounded"
          >
            {saving ? "Saving..." : "Add Make-up"}
          </button>
        </div>
      </div>
    </div>
  );
}
