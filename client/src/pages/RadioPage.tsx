export default function RadioPage() {
  return (
    <div className="p-4 pb-24 h-[80vh] flex flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-bold text-coffee-800 mb-8">PerkUp Radio 🎵</h1>
      
      <div className="relative w-48 h-48 mb-8 mx-auto">
        <div className="absolute inset-0 bg-coffee-200 rounded-full animate-ping opacity-20"></div>
        <div className="absolute inset-2 bg-coffee-600 rounded-full shadow-lg flex items-center justify-center">
          <span className="text-5xl">📻</span>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-800">Lofi Vibes</h2>
      <p className="text-gray-500 text-sm mt-1 mb-8">Зараз грає у закладі</p>

      <div className="w-full max-w-xs mx-auto bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>01:24</span>
          <span>03:45</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className="bg-coffee-500 h-1.5 rounded-full w-[35%]"></div>
        </div>
      </div>
    </div>
  )
}
