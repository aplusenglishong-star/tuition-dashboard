type Props = {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};

export default function AlertModal({ open, title = "Warning", message, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-5 w-[420px]">
        <h3 className="text-lg font-semibold mb-3">{title}</h3>
        <p className="text-gray-700 mb-5">{message}</p>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
