export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Accounts</p>
          <p className="text-3xl font-bold">—</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Channels</p>
          <p className="text-3xl font-bold">—</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-500">Uploads Today</p>
          <p className="text-3xl font-bold">—</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-500">Pool Utilization</p>
          <p className="text-3xl font-bold">—</p>
        </div>
      </div>
    </div>
  );
}
