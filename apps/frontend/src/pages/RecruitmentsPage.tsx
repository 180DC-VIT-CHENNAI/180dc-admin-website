import { motion } from 'motion/react';
import PillNav from '../components/PillNav';
import './RecruitmentsPage.css';

const navItems = [
  { label: "Home", href: "/" },
  { label: "Recruitments", href: "/recruitments" },
];

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
};

const PORTAL_URL = "https://vitc-180dc.org/portal";

interface DeptRole {
  name: string;
  open?: boolean;
}

interface Department {
  id: string;
  name: string;
  tagline: string;
  agenda: string[];
  roles?: DeptRole[];
  openRoles?: string[];
}

const departments: Department[] = [
  {
    id: "tech",
    name: "Technical",
    tagline: "Technology driven solutions for real-world impact.",
    agenda: [
      "Provide technology driven solutions that help NGOs, startups, and social enterprises improve their workflows, efficiency, and impact.",
      "Strengthen 180DC's digital presence by developing and showcasing impactful technological projects and initiatives.",
      "Maintain and continuously improve the club's technical infrastructure, including domains, websites, applications, databases, and digital platforms.",
      "Explore and implement emerging technologies such as AI, agentic AI, automation, and data analytics to address real-world challenges.",
      "Build technical capabilities, reusable resources, and a skilled team that enable 180DC to deliver scalable and sustainable solutions.",
    ],
    roles: [
      { name: "Tech Director" },
      { name: "DevOps Senior Consultant" },
      { name: "Product Senior Consultant" },
      { name: "AI/ML Senior Consultant" },
      { name: "Technical Member", open: true },
    ],
    openRoles: ["Technical Member"],
  },
  {
    id: "marketing",
    name: "Marketing",
    tagline: "Telling 180DC's story to the world.",
    agenda: [
      "Build and grow 180DC's brand presence across campus and online platforms.",
      "Create compelling content and campaigns that drive engagement and recruitment.",
      "Strengthen social media, design, and outreach efforts to amplify our impact.",
    ],
  },
  {
    id: "operations",
    name: "Operations",
    tagline: "Keeping the club running smoothly, every day.",
    agenda: [
      "Coordinate day-to-day club activities, events, and internal workflows.",
      "Ensure seamless execution of projects, meetings, and initiatives.",
      "Maintain organized systems and resources that support every department.",
    ],
  },
  {
    id: "finance",
    name: "Finance",
    tagline: "Managing resources responsibly for sustainable growth.",
    agenda: [
      "Manage budgets, sponsorships, and financial planning for the club.",
      "Ensure transparent and responsible allocation of resources.",
      "Support fundraising and financial sustainability initiatives.",
    ],
  },
  {
    id: "crm",
    name: "Client Relationship Management",
    tagline: "Building lasting partnerships that create impact.",
    agenda: [
      "Manage relationships with NGOs, startups, and social enterprises.",
      "Identify and onboard new clients and consulting opportunities.",
      "Ensure client satisfaction and long-term partnership growth.",
    ],
  },
  {
    id: "business_strategy",
    name: "Business Strategy",
    tagline: "Driving consulting impact with strategic insight.",
    agenda: [
      "Lead consulting engagements that deliver measurable value to clients.",
      "Develop strategic frameworks and insights for real-world problems.",
      "Drive business development and growth for the consultancy.",
    ],
  },
];

const RecruitmentsPage = () => {
  return (
    <div className="recruitments-page">
      <PillNav items={navItems} activeHref="/recruitments" logo="/images/official-logo.png" />

      <motion.section
        className="recruitments-hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <motion.div
          className="recruitments-badge open"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Applications Open
        </motion.div>
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Join <span>180DC VIT Chennai</span>
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Become part of the world's largest student-led consultancy.
          Help social enterprises create meaningful impact while building
          skills that last a lifetime.
        </motion.p>
        <motion.div
          className="recruitments-hero-actions"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <a className="apply-now-btn" href={PORTAL_URL} target="_blank" rel="noopener noreferrer">
            Apply Now
            <span className="apply-arrow">→</span>
          </a>
        </motion.div>
      </motion.section>

      <motion.div className="recruitments-content" variants={pageVariants} initial="initial" animate="animate">
        <div className="departments-header">
          <h2>Open Positions by Department</h2>
          <p>Explore each department to find where you fit best.</p>
        </div>

        <div className="departments-grid">
          {departments.map((dept) => (
            <motion.div
              key={dept.id}
              className="department-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="department-card-head">
                <h3>{dept.name}</h3>
                <span className="department-tagline">{dept.tagline}</span>
              </div>

              <div className="department-agenda">
                <h4>Agenda</h4>
                <ul>
                  {dept.agenda.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              {dept.roles && (
                <div className="department-roles">
                  <h4>Roles</h4>
                  <ul>
                    {dept.roles.map((role) => (
                      <li key={role.name}>
                        <span className="role-name">{role.name}</span>
                        {role.open && <span className="role-open">Open</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {dept.openRoles && (
                <div className="department-open-roles">
                  <h4>Open Roles</h4>
                  {dept.openRoles.map((role) => (
                    <span key={role} className="open-role-pill">{role}</span>
                  ))}
                </div>
              )}

              <a className="department-apply" href={PORTAL_URL} target="_blank" rel="noopener noreferrer">
                Apply for {dept.name} →
              </a>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default RecruitmentsPage;
