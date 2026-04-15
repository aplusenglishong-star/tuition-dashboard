// frontend/src/components/RegeneratePreviewModal.tsx
import { useEffect, useState } from "react";
import api from "../api/client";

type LessonRow = { lesson_number: number; lesson_date: string | null; is_manual_override?: boolean; is_first?: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  packageId: number | null;
  currentLessons: LessonRow[]; // current lessons for the package (array indexed by lesson_number)
  onCommitted?: () => void;     // called after successful regeneration commit
};

export default function RegeneratePreviewModal({ open, onClose, packageId, currentLessons, onCommitted }: Props) {
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [proposed, setProposed] = useState<LessonRow[] | null>(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !packageId) {
      setProposed(null);
      setError(null);
      return;
    }

    // fetch preview
    (async () => {
      setLoadingPreview(true);
      setError(null);
      try {
        const res = await api.get(`/students/packages/${packageId}/regenerate?preview=true`);
        setProposed(res.data.proposed_lessons ?? []);
      } catch (err: any) {
        console.error("Preview failed", err);
        setError(err?.response?.data?.detail || err?.message || "Preview failed");
      } finally {
        setLoadingPreview(false);
      }
    })();
  }, [open, packageId]);

  if (!open) return null;

  const commit = async () => {
    if (!packageId) return;
    setCommitting(true);
    try {
      await api.post(`/students/packages/${packageId}/regenerate`);
      onCommitted?.();
      onClose();
    } catch (err: any) {
      console.error("Commit failed", err);
      alert("Regeneration commit failed: " + (err?.response?.data?.detail || err?.message || ""));
    } finally {
      setCommitting(false);
    }
  };

  // normalize arrays to length 8 for display
  const maxCols = Math.max(
    ...[
      ...currentLessons.map(l => l.lesson_number),
      ...(proposed ?? []).map(l => l.lesson_number),
      4
    ]
  );

  const currentMap = new Map(
    currentLessons.map(l => [l.lesson_number, l])
  );

  const proposedMap = new Map(
    (proposed ?? []).map(l => [l.lesson_number, l])
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 p-4">
      <div className="bg-white rounded shadow-lg w-full max-w-3xl p-4">
        <h3 className="text-lg font-semibold mb-3">Preview Regenerate (Package #{packageId})</h3>

        {loadingPreview ? (
          <div className="p-6 text-center">Loading preview…</div>
        ) : error ? (
          <div className="p-4 text-red-700 bg-red-50 border rounded">{error}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm mb-4">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-2">#</th>
                    <th className="border px-2">Current</th>
                    <th className="border px-2">Proposed</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxCols }).map((_, idx) => {
                    const index = idx + 1;
                    const c = currentMap.get(index) ?? null;
                    const p = proposedMap.get(index) ?? null;
                    const cDate = c?.lesson_date ?? "";
                    const pDate = p?.lesson_date ?? "";
                    const changed = (!!cDate || !!pDate) && cDate !== pDate;
                    return (
                      <tr key={index} className={changed ? "bg-yellow-50" : ""}>
                        <td className="border px-2 text-center">{index}</td>
                        <td className="border px-2">{cDate}</td>
                        <td className="border px-2">
                          <div className="flex items-center justify-between">
                            <div>{pDate}</div>
                            {p?.is_manual_override && <div className="ml-2 text-xs px-1 py-[2px] rounded bg-yellow-100 text-yellow-800 border">M</div>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Proposed changes are preview-only. Confirm to apply changes to the database.
              </div>

              <div className="flex gap-2">
                <button onClick={onClose} disabled={committing} className="px-3 py-2 border rounded">Cancel</button>
                <button onClick={commit} disabled={committing} className="px-3 py-2 bg-red-600 text-white rounded">
                  {committing ? "Applying…" : "Confirm & Apply"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
