import Image from "next/image";

export function PageHero({ eyebrow, title, text, image }: { eyebrow: string; title: string; text?: string; image: string }) {
  return (
    <section className="relative flex min-h-[52vh] items-end overflow-hidden bg-primary pb-14 pt-36">
      <Image src={image} alt="" fill priority sizes="100vw" className="object-cover opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-primary/30" />
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <p className="eyebrow !text-gold-light">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-tight text-white sm:text-6xl">{title}</h1>
        {text && <p className="mt-4 max-w-2xl text-lg text-white/75">{text}</p>}
      </div>
    </section>
  );
}
