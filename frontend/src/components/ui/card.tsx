import * as React from "react"
import { cn } from "@/lib/utils"
import { InfoTooltip } from "@/components/ui/InfoTooltip"

/**
 * Context created by CardHeader carrying the CardDescription content.
 * CardTitle consumes it to render an info icon whose hover tooltip
 * shows the card's description.
 */
const CardHeaderContext = React.createContext<React.ReactNode>(null)

/**
 * Recursively searches the CardHeader subtree for a CardDescription
 * (it may be nested inside layout divs) and returns its content.
 */
const extractDescription = (children: React.ReactNode): React.ReactNode => {
  const arr = React.Children.toArray(children);
  for (const child of arr) {
    if (!React.isValidElement(child)) continue;

    if (child.type === CardDescription) {
      const content = (child.props as { children?: React.ReactNode }).children;
      return content === undefined ? null : content;
    }

    // Descend into host elements (div, span, ...) and fragments only
    if (typeof child.type === "string" || child.type === React.Fragment) {
      const found = extractDescription((child.props as { children?: React.ReactNode }).children);
      if (found !== null) return found;
    }
  }
  return null;
}

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  // Capture the CardDescription content (wherever it sits in the header)
  // and expose it as the info-tooltip text on the CardTitle.
  const descriptionContent = extractDescription(children);

  return (
    <CardHeaderContext.Provider value={descriptionContent}>
      <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5 p-6", className)}
        {...props}
      >
        {children}
      </div>
    </CardHeaderContext.Provider>
  )
})
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => {
  const description = React.useContext(CardHeaderContext)

  return (
    <h3
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight text-slate-900 text-lg", className)}
      {...props}
    >
      {children}
      {description != null && description !== "" && (
        <span className="ml-1.5 inline-flex align-middle">
          <InfoTooltip content={description} />
        </span>
      )}
    </h3>
  )
})
CardTitle.displayName = "CardTitle"

/**
 * Invisible description: renders nothing on screen.
 * Its content is captured by CardHeader and shown ONLY as the
 * info-icon tooltip next to the CardTitle.
 */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(() => null)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
