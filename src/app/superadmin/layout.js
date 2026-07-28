export const metadata = {
  title: "Skystruct SuperAdmin",
  description: "SuperAdmin Dashboard",
};

export default function SuperAdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {children}
    </div>
  );
}
