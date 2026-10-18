// Componentele din admin folosesc next/link; aici devin linkuri react-router (HashRouter).
import { forwardRef, type AnchorHTMLAttributes } from "react";
import { Link as RouterLink } from "react-router-dom";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean };

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, prefetch: _p, ...rest }, ref) {
  if (/^https?:|^mailto:|^tel:/.test(href)) return <a ref={ref} href={href} {...rest} />;
  return <RouterLink ref={ref} to={href} {...rest} />;
});

export default Link;
