import { useEffect } from "react";
import { useLocation, useRouter } from "wouter";
import { signedInPage } from "@/lib/routing";

/** Keep SPA navigation consistent with the private, empty prerender shells. */
export function SignedInMetadata() {
  const [location] = useLocation();
  const { base } = useRouter();
  const page = signedInPage(location);
  const path = page?.canonicalPath;
  const title = page?.title;

  useEffect(() => {
    if (!path || !title) return;
    const previousTitle = document.title;
    document.title = `${title} | Kindred Asterling`;
    const canonical = new URL(`${base}${path}`, window.location.origin).href;
    const undo = [
      ["link", "rel", "canonical", "href", canonical],
      ["meta", "property", "og:url", "content", canonical],
      ["meta", "name", "robots", "content", "noindex, nofollow"],
    ].map(([tag, key, value, attribute, content]) => {
      const existing = document.head.querySelector(`${tag}[${key}="${value}"]`);
      const element = existing ?? document.createElement(tag);
      const previous = element.getAttribute(attribute);
      element.setAttribute(key, value);
      element.setAttribute(attribute, content);
      if (!existing) document.head.append(element);
      return () => {
        if (!existing) element.remove();
        else if (previous === null) element.removeAttribute(attribute);
        else element.setAttribute(attribute, previous);
      };
    });
    return () => {
      document.title = previousTitle;
      undo.forEach((restore) => restore());
    };
  }, [base, path, title]);

  return null;
}
