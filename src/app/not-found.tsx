import { Crown } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ivory px-6 text-center">
      <Crown className="h-8 w-10 text-gold" />
      <p className="eyebrow mt-6">Error 404</p>
      <h1 className="mt-3 font-serif text-5xl text-primary">This page has checked out.</h1>
      <p className="mt-4 max-w-md text-muted-foreground">The page you are looking for doesn&apos;t exist or has moved.</p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/">Return home</ButtonLink>
        <ButtonLink href="/book" variant="outline">Book a stay</ButtonLink>
      </div>
    </div>
  );
}
