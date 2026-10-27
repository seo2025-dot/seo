import type { MetadataRoute } from "next";

// Versión aparcada en ciudad.conectari.com: que ningún buscador la rastree.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
