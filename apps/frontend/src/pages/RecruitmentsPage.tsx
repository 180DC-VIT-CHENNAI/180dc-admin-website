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
          className="recruitments-badge closed"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Applications Closed
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
      </motion.section>

      <motion.div className="recruitments-content" variants={pageVariants} initial="initial" animate="animate">
        <div className="recruitments-cta" style={{ border: "none", boxShadow: "none" }}>
          <h3>Applications are currently closed</h3>
          <p>We're not accepting applications right now. Check back later for recruitment updates.</p>
        </div>
      </motion.div>
    </div>
  );
};

export default RecruitmentsPage;
