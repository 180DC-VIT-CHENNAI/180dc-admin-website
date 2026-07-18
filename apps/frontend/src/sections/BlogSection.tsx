import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { apiUrl } from "../lib/api";

gsap.registerPlugin(ScrollTrigger);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props {
  blogPosts: any[];
}

export default function BlogSection({ blogPosts }: Props) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (blogPosts.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".blog-grid").forEach((grid) => {
        const cards = grid.querySelectorAll(".blog-card");
        gsap.fromTo(
          cards,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.12,
            ease: "power3.out",
            scrollTrigger: {
              trigger: grid,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blogPosts.length]);

  return (
    <section id="blog" className="blog-section" ref={sectionRef}>
      <div className="container">
        <div className="section-header reveal" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", maxWidth: "none" }}>
          <div>
            <span className="eyebrow">04 — Blog</span>
            <h2 className="section-heading" style={{ margin: 0 }}>
              Consulting Insights
            </h2>
            <p style={{ fontSize: "1.125rem", color: "var(--text-secondary)", margin: 0 }}>
              Insights from our consultants and network.
            </p>
          </div>
          <a href="/post-blog" className="btn outline">
            Post a Blog
          </a>
        </div>
        <div
          className="blog-grid"
          style={
            blogPosts.length > 4
              ? { maxHeight: 520, overflowY: "auto", paddingRight: 8 }
              : undefined
          }
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {blogPosts.slice(0, 6).map((post: any, i: number) => (
            <div
              key={i}
              className="blog-card card-doodle"
              style={{ position: "relative" }}
            >
              {post.image_url && (
                <div
                  style={{
                    width: "calc(100% + 48px)",
                    height: 160,
                    overflow: "hidden",
                    borderRadius: "15px 15px 0 0",
                    marginTop: "-24px",
                    marginLeft: "-24px",
                    marginRight: "-24px",
                    marginBottom: "16px",
                  }}
                >
                  <img
                    src={apiUrl(post.image_url)}
                    alt=""
                    loading="lazy"
                    width="700"
                    height="160"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              )}
              <span className="blog-date">
                {post.date ||
                  new Date(post.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
              </span>
              <h3>{post.title}</h3>
              <p>{post.excerpt || post.description}</p>
              <a
                href={post.slug ? `/blog/${post.slug}` : "#"}
                className="read-more-btn"
              >
                {post.slug ? "Read Full Post" : "Read Post"}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
