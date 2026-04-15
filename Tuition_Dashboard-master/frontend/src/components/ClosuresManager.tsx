// frontend/src/components/ClosuresManager.tsx
import { useEffect, useState } from "react";
import api from "../api/client";

type Closure = {
  id: number;
  start_date: string;
  end_date: string;
  reason?: string;
  type?: string;
};

type EditPayload = {
  start_date: string;
  end_date: string;
  reason?: string | null;
  type?: string | null;
};

function EditClosureModal({
  open,
  onClose,
  closure,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  closure: Closure | null;
  onSaved?: () => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [ctype, setCtype] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (closure) {
      setStartDate(closure.start_date ?? "");
      setEndDate(closure.end_date ?? "");
      setReason(closure.reason ?? "");
      setCtype(closure.type ?? "");
      setError(null);
    } else {
      setStartDate("");
      setEndDate("");
      setReason("");
      setCtype("");
      setError(null);
    }
  }, [closure, open]);

  if (!open || !closure) return null;

  const save = async () => {
    if (!startDate || !endDate) return setError("Start and end date are required");
    setSaving(true);
    setError(null);
    try {
      const payload: EditPayload = {
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
        type: ctype || null,
      };
      await api.patch(`/closures/${closure.id}`, payload);
      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error("update closure", err);
      setError(err?.response?.data?.detail || err?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded shadow-lg w-full max-w-md p-4">
        <h3 className="text-lg font-semibold mb-3">Edit Closure #{closure.id}</h3>

        {error && <div className="mb-3 text-red-700 bg-red-50 p-2 rounded">{error}</div>}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs block mb-1">Start</label>
            <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="p-2 border w-full" />
          </div>
          <div>
            <label className="text-xs block mb-1">End</label>
            <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="p-2 border w-full" />
          </div>
          <div className="col-span-2">
            <label className="text-xs block mb-1">Reason</label>
            <input placeholder="Optional" value={reason} onChange={e=>setReason(e.target.value)} className="p-2 border w-full" />
          </div>
          <div className="col-span-2">
            <label className="text-xs block mb-1">Category</label>
            <input placeholder="holiday/term" value={ctype} onChange={e=>setCtype(e.target.value)} className="p-2 border w-full" />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="px-3 py-2 border rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-3 py-2 bg-blue-600 text-white rounded">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClosuresManager() {
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(false);

  // form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [ctype, setCtype] = useState("");

  // edit modal state
  const [editing, setEditing] = useState<Closure | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closureToDelete, setClosureToDelete] = useState<Closure | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);



  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/closures/");
      setClosures(res.data);
    } catch (e) {
      console.error("load closures", e);
      alert("Failed to load closures");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return alert("Start and end date required");
    try {
      await api.post("/closures/", {
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
        type: ctype || null
      });
      setStartDate(""); setEndDate(""); setReason(""); setCtype("");
      await load();
    } catch (err: any) {
      console.error("create closure", err);
      alert("Create failed: " + (err?.response?.data?.detail || err?.message || ""));
    }
  };

  const openEdit = (c: Closure) => {
    setEditing(c);
    setEditOpen(true);
  };

  const onSaved = async () => {
    await load();
  };

  return (
    <div className="p-6">
      {/* Back Button */}
      <div className="mb-4">
         <button
          onClick={() => window.location.href = "/"}
          className="text-blue-600 hover:text-blue-800 transition-transform duration-200 hover:-translate-x-1"
        >
          <span className="text-4xl">←</span>
         </button>
      </div>
      <h2 className="text-xl font-semibold mb-3">Closures (Holidays / Breaks)</h2>

      <form onSubmit={create} className="mb-4 grid grid-cols-4 gap-2 items-end">
        <div>
          <label className="text-xs block mb-1">Start</label>
          <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="p-2 border w-full" />
        </div>
        <div>
          <label className="text-xs block mb-1">End</label>
          <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="p-2 border w-full" />
        </div>
        <div>
          <label className="text-xs block mb-1">Reason</label>
          <input placeholder="Optional" value={reason} onChange={e=>setReason(e.target.value)} className="p-2 border w-full" />
        </div>
        <div>
          <label className="text-xs block mb-1">Category</label>
          <input placeholder="holiday/term" value={ctype} onChange={e=>setCtype(e.target.value)} className="p-2 border w-full" />
        </div>

        <div className="col-span-4 mt-2">
          <button
            type="submit"
            className="px-3 py-2 bg-green-600 text-white rounded mr-2 
                      hover:bg-green-700 hover:scale-[1.03] transition-all"
          >
            Add Closure
          </button>
          <button
            type="button"
            onClick={() => { setStartDate(""); setEndDate(""); setReason(""); setCtype(""); }}
            className="px-3 py-2 border rounded
                      hover:bg-gray-100 hover:scale-[1.03] transition-all"
          >
            Clear
          </button>
        </div>
      </form>

      <div className="mb-2 text-sm text-gray-600">Status: {loading ? "loading…" : `Loaded ${closures.length}`}</div>

      <div className="bg-white border rounded overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2">ID</th>
              <th className="border px-2">Start</th>
              <th className="border px-2">End</th>
              <th className="border px-2">Reason</th>
              <th className="border px-2">Category</th>
              <th className="border px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {closures.map(c => (
              <tr key={c.id}>
                <td className="border px-2">{c.id}</td>
                <td className="border px-2">{c.start_date}</td>
                <td className="border px-2">{c.end_date}</td>
                <td className="border px-2">{c.reason}</td>
                <td className="border px-2">{c.type}</td>
                <td className="border px-2 space-x-2">
                {/* EDIT BUTTON */}
                <button
                  onClick={() => {openEdit(c)}}
                  className="px-2 py-1 text-sm border rounded
                            hover:bg-blue-100 hover:scale-[1.03] transition-all"
                >
                  Edit
                </button>

                {/* DELETE BUTTON */}
                <button
                onClick={() => {
                  setClosureToDelete(c);
                  setConfirmOpen(true);
                }}
                className="px-2 py-1 text-sm bg-red-600 text-white rounded
                          hover:bg-red-700 hover:scale-[1.03] transition-all"
              >
                Delete
              </button>
              </td>
              </tr>
            ))}
            {closures.length === 0 && (
              <tr><td className="p-4" colSpan={6}>No closures defined.</td></tr>
            )}
          </tbody>
        </table>

      </div>

      <EditClosureModal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditing(null); }}
        closure={editing}
        onSaved={onSaved}
      />

      {confirmOpen && (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
    <div className="bg-white rounded-lg shadow-lg p-6 w-[380px]">
      <h2 className="text-xl font-semibold mb-3">Delete Closure?</h2>
      <p className="text-gray-700 mb-6">
        Are you sure you want to delete this closure? 
        <br />
        <span className="font-medium">{closureToDelete?.start_date} → {closureToDelete?.end_date}</span>
        <p>This action cannot be undone.</p>
      </p>

      <div className="flex justify-end gap-3">
        <button
          onClick={() => {
            setConfirmOpen(false);
            setClosureToDelete(null);
          }}
          className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100"
        >
          Cancel
        </button>

        <button
          onClick={async () => {
            if (!closureToDelete) return;
            setDeletingId(closureToDelete.id);
            try {
              await api.delete(`/closures/${closureToDelete.id}`);
              await load();
            } catch (err) {
              alert("Failed to delete closure");
            }
            setDeletingId(null);
            setClosureToDelete(null);
            setConfirmOpen(false);
          }}
          className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
        >
          {deletingId === closureToDelete?.id ? "Deleting…" : "Confirm"}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}
