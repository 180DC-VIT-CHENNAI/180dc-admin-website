// orgChartData.ts
export interface OrgChartPerson {
  name: string;
  role: string;
  photo?: string;
}

export interface TreeNode extends OrgChartPerson {
  children?: TreeNode[];
}

export const facultyAdvisor: OrgChartPerson = {
  name: "Dr. Balaji",
  role: "Faculty Coordinator",
  photo: "/leads/faculty.png", 
};

export const orgChartTree: TreeNode = {
  name: "Saad Siddiqui",
  role: "President",
  photo: "/leads/prez.png",
  children: [
    {
      name: "S Yaswaanth",
      role: "Vice President",
      photo: "/leads/vp.png",
      children: [
        {
          name: "Rounak Handa",
          role: "Business Strategy Director",
          photo: "/leads/bsd.png",
          children: [
            { name: "Paramveer Singh Vilkhu", role: "CPS Lead", photo: "/leads/cps.png" },
          ],
        },
        {
          name: "Sanjana Chejeti",
          role: "Marketing Director",
          photo: "/leads/marketing.png",
          children: [
            { name: "Khyati Mohapatra", role: "Social Media Lead", photo: "/leads/sm.png" },
          ],
        },
        {
          name: "Sowmiya Vijayakumar",
          role: "HR Director",
          photo: "/leads/hr.png",
        },
        {
          name: "Riddhima Singh",
          role: "Finance & Legal Director",
          photo: "/leads/finlegal.png",
          children: [
            { name: "Mahak Khetan", role: "Research & Development", photo: "/leads/rnd-1.png" }
          ]
        },
      ],
    },
    {
      name: "Sharan K",
      role: "Vice President",
      photo: "/leads/vp-2.png",
      children: [
        { 
          name: "Sanjay Sivakumar", 
          role: "Technical Director", 
          photo: "/leads/tech.png",
          children: [
            { name: "Shivam Pandey", role: "Research & Development", photo: "/leads/rnd-2.png" }
          ]
        },
        { name: "Sonakshi Agrawal", role: "Events & Initiatives", photo: "/leads/events.png" },
        { name: "Vansh Goel", role: "Events & Initiatives", photo: "/leads/events-2.png" },
      ],
    },
  ],
};