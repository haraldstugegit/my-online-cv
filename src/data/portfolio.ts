// Portfolio content, based on the CV. Wrap text in **double asterisks** to bold it.

export type CategoryId = "education" | "experience" | "projects" | "about";

export type Category = {
  id: CategoryId;
  label: string;
  /** Line colour (works on light and dark backgrounds). */
  color: string;
  /** Text colour classes with enough contrast in both themes. */
  text: string;
  /** Which background line becomes this category's thread (and later its rail). */
  thread: { family: 1 | -1; index: number };
};

const allCategories: Category[] = [
  {
    id: "education",
    label: "Education",
    color: "#3b82f6",
    text: "text-blue-600 dark:text-blue-400",
    thread: { family: 1, index: 8 },
  },
  {
    id: "experience",
    label: "Experience",
    color: "#f59e0b",
    text: "text-amber-600 dark:text-amber-400",
    thread: { family: 1, index: 20 },
  },
  {
    id: "projects",
    label: "Projects & Skills",
    color: "#10b981",
    text: "text-emerald-600 dark:text-emerald-400",
    thread: { family: -1, index: 12 },
  },
  {
    id: "about",
    label: "About me",
    color: "#f43f5e",
    text: "text-rose-600 dark:text-rose-400",
    thread: { family: -1, index: 25 },
  },
];

/** Hidden until there is more on GitHub to show. Remove an id here to bring it back. */
const hidden: CategoryId[] = ["projects"];

export const categories = allCategories.filter((c) => !hidden.includes(c.id));

export const profile = {
  name: "Harald Stuge.",
  tagline: "Data scientist turned innovation student.",
  location: "Oslo · London",
  /** Short bio shown right after the hero, while the lines still glide. */
  intro:
    "**Aspiring Product Manager.** Two years building LLM products as a data scientist at Rystad Energy, now doing an MSc at Imperial College London.",
};

export const education = [
  {
    school: "Imperial College London",
    degree: "MSc Innovation, Entrepreneurship & Management",
    period: "2026 – 2027",
    details:
      "Technology and innovation, venture strategy, and **product and project leadership**.",
  },
  {
    school: "NTNU",
    degree: "Bachelor of Informatics",
    period: "2021 – 2024",
    details:
      "Math, communication technology and **product development**. Teaching assistant in discrete mathematics.",
  },
];

export const experience = [
  {
    company: "Rystad Energy",
    role: "Data Scientist",
    period: "2024 – 2026",
    details:
      "Shipped an **LLM reporting product** that condenses up to 100 memos a week into short, targeted reports, saving each reader about **1.5 hours of triage a week**. The report generation backend takes inspiration from **GraphRAG**, so it can group themes and entities across memos without overloading the model's context. Core member of the LLM team as our products moved from standard RAG to **agentic, tool-using systems**.",
    tags: ["Python", "LLMs", "GraphRAG", "Agents", "FastAPI"],
  },
  {
    company: "Rystad Energy",
    role: "Data Integration Intern",
    period: "Summer 2023",
    details:
      "Designed and built an **ETL pipeline** syncing user activity into the sales team's CRM, and presented it company-wide.",
    tags: ["Python", "PostgreSQL", "ETL"],
  },
  {
    company: "NTNU",
    role: "Teaching Assistant, Discrete Mathematics",
    period: "Autumn 2022",
    details:
      "Graded weekly assignments and ran guidance sessions for **30 students**.",
    tags: ["Teaching", "Math"],
  },
  {
    company: "Swims",
    role: "Sales and Logistics Intern",
    period: "2020 – 2021",
    details:
      "Managed **B2B customer relationships** and took over **all EU customer service**, coordinating deliveries with the warehouse in the Netherlands.",
    tags: ["B2B", "Customer service", "Logistics"],
  },
  {
    company: "Norwegian Armed Forces",
    role: "Fire Safety Soldier",
    period: "2019 – 2020",
    details:
      "Served as a **smoke diver** with **HSE** responsibilities, and **organised training** exercises for recruits.",
    tags: ["Teamwork", "HSE", "Training"],
  },
];

export const projects: {
  name: string;
  summary: string;
  tags: string[];
  href?: string;
}[] = [
  {
    name: "RAG products",
    summary:
      "Built and shipped **retrieval-augmented generation** products, from document ingestion and retrieval to grounded answers, and helped move them towards **agentic, tool-using** systems.",
    tags: ["RAG", "LLMs", "Agents"],
  },
  {
    name: "NL2SQL",
    summary:
      "Part of the team building a **natural language to SQL** assistant that turns plain-English questions into queries over structured data.",
    tags: ["NL2SQL", "LLMs", "SQL"],
  },
  {
    name: "Finding themes in text",
    summary:
      "**Clustering high-dimensional text embeddings** to group large volumes of documents by meaning and surface the themes a keyword search would miss.",
    tags: ["Embeddings", "Clustering", "Unsupervised ML"],
  },
  {
    name: "Rapid R&D sprints",
    summary:
      "Hackathon-style sprints at Rystad that turned vague briefs into **assessed technical roadmaps**: methane emission detection, embedder fine-tuning and vessel destination prediction.",
    tags: ["ML", "Prototyping"],
  },
  {
    name: "Personal newsletter",
    // TODO: add href to the GitHub repo once it's public.
    summary:
      "A **personal newsletter** side project. Code on GitHub, link coming soon.",
    tags: ["Side project"],
  },
  {
    name: "This site",
    summary:
      "A one-page portfolio built around a **scroll-driven line-and-point animation**.",
    tags: ["Next.js", "Framer Motion", "Canvas"],
  },
];

export const about = {
  headline: "Aspiring Product Manager",
  bio: "I'm a **tech enthusiast** and **curious by nature**, so I love to learn. After two years of work experience as a **data scientist** the natural step was a degree focusing on Innovation. Away from the screen I love **nature** and **sports**. I play **tennis** and **padel**, and I love **skiing**, cross country, downhill and ski mountaineering.",
  keywords: [
    {
      label: "Background",
      items: ["Data science", "LLM products", "RAG & agents"],
    },
    {
      label: "Now",
      items: [
        "MSc Innovation at Imperial",
        "Product strategy",
        "Venture building",
      ],
    },
  ],
  contact: [
    { label: "Email", href: "mailto:harald@stuge.no" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/harald-stuge/" },
  ],
};
