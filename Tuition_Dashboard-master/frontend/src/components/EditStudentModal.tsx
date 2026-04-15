// src/components/EditStudentModal.tsx
import { useEffect, useState } from "react";
import api from "../api/client";

type Props = {
  open: boolean;
  onClose: () => void;
  student: any | null; // simplified, use proper typing if you want
  onSaved?: () => void;
};

export default function EditStudentModal({ open, onClose, student, onSaved }: Props) {
  const [name, setName] = useState("");
  const [cefr, setCefr] = useState("");
  const [groupName, setGroupName] = useState("");
  const [lessonDay1, setLessonDay1] = useState<number>(0);
  const [lessonDay2, setLessonDay2] = useState<number | "">("");
  const [packageSize, setPackageSize] = useState<number>(4);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>(""); // NEW

  useEffect(() => {
    if (student) {
      setName(student.name ?? "");
      setCefr(student.cefr ?? "");
      setGroupName(student.group_name ?? "");
      setLessonDay1(student.lesson_day_1 ?? 0);
      setLessonDay2(student.lesson_day_2 ?? "");
      setPackageSize(student.package_size ?? 4);
      setStartDate(student.start_date ?? "");
      setEndDate(student.end_date ?? ""); // NEW
    }
  }, [student]);

  if (!open || !student) return null;

  const save = async () => {
    try {
      const payload: any = {
        name,
        cefr,
        group_name: groupName,
        lesson_day_1: Number(lessonDay1),
        package_size: Number(packageSize),
        start_date: startDate || undefined,
      };
      payload.lesson_day_2 = lessonDay2 === "" ? null : Number(lessonDay2);
      // explicitly include end_date; allow clearing by sending null
      payload.end_date = endDate === "" ? null : endDate;

      await api.patch(`/students/${student.student_id}`, payload);
      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error("Update student failed", err?.response ?? err);
      alert("Update failed: " + (err?.response?.data?.detail || err.message || "unknown"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white p-4 rounded w-[480px] max-w-full">
        <h2 className="text-lg font-semibold mb-3">Edit Student</h2>

        <div className="grid grid-cols-2 gap-2">
          <input className="p-2 border" value={name} onChange={e=>setName(e.target.value)} placeholder="Name" />
          <input className="p-2 border" value={cefr} onChange={e=>setCefr(e.target.value)} placeholder="CEFR" />
          <input className="p-2 border" value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Group" />

          <select value={lessonDay1} onChange={e=>setLessonDay1(Number(e.target.value))} className="p-2 border">
            <option value={0}>Mon</option><option value={1}>Tue</option><option value={2}>Wed</option>
            <option value={3}>Thu</option><option value={4}>Fri</option><option value={5}>Sat</option><option value={6}>Sun</option>
          </select>

          <select value={lessonDay2} onChange={e=>setLessonDay2(e.target.value === "" ? "" : Number(e.target.value))} className="p-2 border">
            <option value="">(none)</option>
            <option value={0}>Mon</option><option value={1}>Tue</option><option value={2}>Wed</option>
            <option value={3}>Thu</option><option value={4}>Fri</option><option value={5}>Sat</option><option value={6}>Sun</option>
          </select>

          <select value={packageSize} onChange={e=>setPackageSize(Number(e.target.value))} className="p-2 border">
            <option value={4}>4 lessons</option>
            <option value={8}>8 lessons</option>
          </select>

          <input className="p-2 border" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} />
          <input className="p-2 border" type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} /> {/* NEW */}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 border rounded">Cancel</button>
          <button onClick={save} className="px-3 py-2 bg-green-600 text-white rounded">Save</button>
        </div>
      </div>
    </div>
  );
}
