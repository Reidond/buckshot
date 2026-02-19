export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Account Detail</h1>
      <p className="text-gray-500">Account ID: {id}</p>
      <p className="text-gray-500">
        TODO: Show channel info, project assignment, upload history, re-auth.
      </p>
    </div>
  );
}
