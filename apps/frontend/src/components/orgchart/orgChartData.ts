export interface OrgChartPerson {
  name: string;
  role: string;
  photo?: string;
  linkedin?: string;
}

export const facultyCoordinator: OrgChartPerson = {
  name: "Dr. Balaji",
  role: "Faculty Coordinator",
  photo: "/leads/faculty-coordinator.png",
  linkedin: "#",
};

export const coreLeadership: OrgChartPerson[] = [
  {
    name: "Sharan K",
    role: "Chairperson",
    photo: "/leads/chairperson.png",
    linkedin: "https://www.linkedin.com/in/sharan-k-719300345/",
  },
  {
    name: "Sanjana Chejeti",
    role: "Vice Chairperson",
    photo: "/leads/vice-chairperson.png",
    linkedin: "https://www.linkedin.com/in/sanjana-chejeti-565355298/",
  },
  {
    name: "Sonakshi Agrawal",
    role: "Secretary",
    photo: "/leads/secretary.png",
    linkedin: "https://www.linkedin.com/in/sonakshi-agrawal-6685991bb/",
  },
  {
    name: "Sanjay Sivakumar",
    role: "Co-Secretary",
    photo: "/leads/co-secretary.png",
    linkedin: "https://www.linkedin.com/in/sanjaysivakumar11/",
  },
];

export const departmentDirectors: OrgChartPerson[] = [
  {
    name: "Kevin Daniel",
    role: "Technical Director",
    linkedin: "https://www.linkedin.com/in/l-kevin-daniel-3a2979392/",
  },
  {
    name: "Shahid Ashraf",
    role: "Marketing Director",
    photo: "/leads/marketing-director.jpeg",
    linkedin: "https://www.linkedin.com/in/shaik-shaheed-ashraf-43a836236/",
  },
  {
    name: "Vansh Goel",
    role: "Operations Director",
    photo: "/leads/operations-director.jpeg",
    linkedin: "https://www.linkedin.com/in/vansh-goel-rksh",
  },
  {
    name: "Rishita",
    role: "Business Strategy Director",
    photo: "/leads/buisness-director.jpeg",
    linkedin: "https://www.linkedin.com/in/rishita-r-257506335",
  },
  {
    name: "Paramveer Singh",
    role: "Client Relationship Director",
    photo: "/leads/client-relation-director.png",
    linkedin: "https://www.linkedin.com/in/paramveer-singh-vilkhu/",
  },
  {
    name: "Sanath Garg",
    role: "Finance Director",
    linkedin: "https://www.linkedin.com/in/sanath-garg-356a7331b/",
  },
];
