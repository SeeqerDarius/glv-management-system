import { cn } from "@/lib/utils";

type ProfileAvatarProps = {
  name?: string | null;
  src?: string | null;
  className?: string;
};

export function ProfileAvatar({ name, src, className }: ProfileAvatarProps) {
  const initial = (name || "G").slice(0, 1).toUpperCase();

  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-lime-200 bg-lime-50 text-sm font-bold text-green-900 shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
