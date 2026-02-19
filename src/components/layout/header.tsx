"use client";

export function Header() {
  return (
    <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
      <div />
      <div className="flex items-center gap-4">
        <button className="relative p-1 rounded hover:bg-gray-100" type="button">
          <span>Notifications</span>
        </button>
        <span className="text-sm text-gray-600">Admin</span>
      </div>
    </header>
  );
}
