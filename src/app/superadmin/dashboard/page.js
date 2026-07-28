import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAccessToken } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

async function getAdmins() {
  const cookieStore = await cookies();
  const token = cookieStore.get("sa_token")?.value;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/superadmin/admins`,
    {
      headers: { Cookie: `sa_token=${token}` },
      cache: "no-store",
    }
  );

  if (!res.ok) return [];
  return res.json();
}

export default async function SuperAdminDashboard() {
  // Auth guard
  const cookieStore = await cookies();
  const token = cookieStore.get("sa_token")?.value;
  if (!token) redirect("/superadmin/login");

  const decoded = verifyAccessToken(token);
  if (!decoded?.isSuperAdmin) redirect("/superadmin/login");

  const admins = await getAdmins();

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Top navbar */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
           
            <h1 className="text-xl font-black text-white tracking-tight">
              Skystruct
            </h1>
          </div>
          <span className="bg-blue-600/20 text-blue-400 text-xs font-bold px-3 py-1 rounded-full border border-blue-600/30">
            SuperAdmin
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">
            Welcome, <span className="text-white font-semibold">{decoded.name}</span>
          </span>
          <LogoutButton />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Stats bar */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-white">Admin Registry</h2>
            <p className="text-gray-400 text-sm mt-1">
              All registered admin workspaces in the platform
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 text-center">
            <p className="text-3xl font-black text-blue-400">{admins.length}</p>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">
              Total Admins
            </p>
          </div>
        </div>

        {/* Table */}
        {admins.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
            <p className="text-gray-500 text-lg font-medium">No admins registered yet.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">#</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Admin</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Organization</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                  <th className="text-center px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Users</th>
                  <th className="text-center px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Projects</th>
                  <th className="text-center px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Templates</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Registered</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((item, index) => (
                  <tr
                    key={item.orgId}
                    className="border-b border-gray-800/60 hover:bg-gray-800/40 transition"
                  >
                    <td className="px-6 py-4 text-gray-500 text-sm font-medium">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white font-semibold text-sm">
                          {item.admin?.name || "—"}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {item.admin?.email || "—"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-300 text-sm font-medium">{item.orgName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          item.admin?.status === "Active"
                            ? "bg-green-900/40 text-green-400 border border-green-700/40"
                            : "bg-gray-800 text-gray-400 border border-gray-700"
                        }`}
                      >
                        {item.admin?.status || "Active"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-white font-bold text-sm">{item.stats.userCount}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-white font-bold text-sm">{item.stats.projectCount}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-white font-bold text-sm">{item.stats.templateCount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-400 text-sm">
                        {new Date(item.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
