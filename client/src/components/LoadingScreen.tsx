interface Props {
  message?: string
}

export default function LoadingScreen({ message }: Props) {
  return (
    <div className="fixed inset-0 bg-coffee-600 flex flex-col items-center justify-center z-50">
      <div className="text-7xl mb-4 animate-pulse">☕</div>
      <div className="text-coffee-100 font-bold text-2xl mb-2">PerkUp</div>
      {message && (
        <div className="text-coffee-300 text-sm">{message}</div>
      )}
    </div>
  )
}
