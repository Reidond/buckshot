export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Job Detail</h1>
      <p className="text-gray-500">Job ID: {id}</p>
      <p className="text-gray-500">
        TODO: Per-channel task status, YouTube links with copy-all, error logs.
      </p>
    </div>
  );
}
