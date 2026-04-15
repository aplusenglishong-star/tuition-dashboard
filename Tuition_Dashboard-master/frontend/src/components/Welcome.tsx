import { Link } from "react-router-dom";
import bg from "../assets/bg.jpg";

export default function Welcome() {
  return (
    <div
      className="relative flex flex-col items-center justify-center h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(${bg})` }}
    >
      {/* Background dark overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-40"></div>

      {/* Smaller content card */}
      <div className="relative bg-white/70 backdrop-blur-md p-6 rounded-xl shadow-xl text-center max-w-md w-[55%]">

        {/* Typing animation title */}
        <h1
          className="text-4xl mb-6 text-gray-900"
          style={{ fontFamily: "'Forte', cursive" }}
        >
          <span className="typing">Welcome</span>
        </h1>

        {/* Buttons stacked */}
        <div className="flex flex-col gap-3">
          <Link
            to="/dashboard"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-lg font-semibold shadow hover:bg-blue-700 hover:scale-[1.03] transition-transform"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Click here to view the Tuition Dashboard
          </Link>

          <Link
            to="/closures"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg text-lg font-semibold shadow hover:bg-gray-800 hover:scale-[1.03] transition-transform"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Click here to Manage Closures
          </Link>
        </div>

      </div>
    </div>
  );
}
