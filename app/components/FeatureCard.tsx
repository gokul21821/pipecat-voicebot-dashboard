interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-zinc-50 border border-zinc-100 hover:border-zinc-200 transition-colors">
      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-black text-white">
        {icon}
      </div>
      <p className="text-sm font-semibold text-zinc-800">{title}</p>
      <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}
