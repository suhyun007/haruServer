export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">HaruFit Server</h1>
        <p className="text-lg text-gray-600">API 서버가 실행 중입니다</p>
        <div className="mt-8 text-sm text-gray-500">
          <p>API Endpoints:</p>
          <ul className="mt-2 space-y-1">
            <li>GET/POST /api/users</li>
            <li>GET/PUT /api/users/[id]</li>
            <li>GET/POST /api/meals</li>
            <li>DELETE /api/meals/[id]</li>
            <li>GET/POST /api/weights</li>
          </ul>
        </div>
      </div>
    </main>
  )
}

