import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
        gold: "bg-gold text-white hover:bg-[#a6824a] shadow-sm",
        outline: "border border-input bg-white text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        subtle: "bg-muted text-foreground hover:bg-[#e8e5dc]",
        danger: "bg-danger text-white hover:bg-[#9a1d14] shadow-sm",
        "danger-outline": "border border-danger/30 text-danger bg-white hover:bg-danger-soft",
        link: "text-foreground underline-offset-4 hover:underline px-0",
        light: "bg-white/10 text-white border border-white/30 backdrop-blur hover:bg-white/20",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-sm tracking-wide",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
