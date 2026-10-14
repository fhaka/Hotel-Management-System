import Image from "next/image";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-primary lg:block">
        <Image
          src="https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1600&q=80"
          alt="The Imperial Lounge"
          fill
          priority
          sizes="50vw"
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-primary/20" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo tone="light" />
          <div className="max-w-md">
            <p className="eyebrow !text-gold-light">Since 1938</p>
            <p className="mt-4 font-serif text-4xl leading-tight text-white">A timeless address in the heart of Tirana.</p>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Sign in to manage your reservations, or access the hotel operations suite.
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col bg-ivory">
        <div className="p-6 lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10">{children}</div>
      </div>
    </div>
  );
}
