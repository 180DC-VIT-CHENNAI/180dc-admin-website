export interface Partner {
    name: string;
    slug: string;
    logo: string;
  }
  
  /**
   * Static partner logos served from apps/frontend/public/partners/.
   * Vite serves anything in /public/ at the root, so the path here
   * is just "/partners/<filename>" — no import needed.
   */
  export const PARTNERS: Partner[] = [
    { name: "AdigoVR", slug: "adigo", logo: "/partners/adigo.png" },
    {
      name: "Buy Food With Plastic — Sustainability X Hunger Relief",
      slug: "bfwp",
      logo: "/partners/bfwp.png",
    },
    { name: "JoySuperApp", slug: "joy", logo: "/partners/joy.png" },
    { name: "SaiRa Jobs", slug: "saira", logo: "/partners/saira.png" },
    { name: "YAAPT", slug: "yaapt", logo: "/partners/yaapt.png" },
  ];