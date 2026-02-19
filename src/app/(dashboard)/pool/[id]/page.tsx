export default async function PoolProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Project Detail</h1>
      <p className="text-gray-500">Project ID: {id}</p>
      <p className="text-gray-500">TODO: Show accounts, quota graph, daily uploads.</p>
    </div>
  );
}
