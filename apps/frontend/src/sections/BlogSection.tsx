import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScribbleSquiggle } from "../components/DoodleSVG";
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
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.15,
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
        <div className="section-header reveal">
          <div>
            <span className="section-label">04 — Blog</span>
            <h2 className="section-heading" style={{ margin: 0 }}>
              Consulting Insights
            </h2>
            <p
              style={{
                fontFamily: "'Patrick Hand', cursive",
                fontSize: "1.2rem",
                margin: 0,
              }}
            >
              Insights from our consultants and network.
            </p>
          </div>
          <a href="/post-blog" className="btn outline post-blog-btn">
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
                    width: "calc(100% + 32px)",
                    height: 140,
                    overflow: "hidden",
                    borderRadius: "10px 10px 0 0",
                    marginTop: -16,
                    marginLeft: -16,
                    marginRight: -16,
                    marginBottom: 12,
                  }}
                >
                  <img
                    src={apiUrl(post.image_url)}
                    alt=""
                    loading="lazy"
                    width="700"
                    height="140"
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
        <ScribbleSquiggle
          style={{
            width: 150,
            color: "#8dc63f",
            margin: "3rem auto 0",
            display: "block",
          }}
        />
      </div>
    </section>
  );
}