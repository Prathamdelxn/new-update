"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/superadmin/auth/logout", { method: "POST" });
    router.push("/superadmin/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-bold px-4 py-2 rounded-xl transition"
    >
      Logout
    </button>
  );
}
