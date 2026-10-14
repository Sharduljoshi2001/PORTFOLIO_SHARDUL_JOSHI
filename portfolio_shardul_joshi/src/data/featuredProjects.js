// Hand-picked projects shown first on the Projects page ("Selected work").
// Edit freely: title, description and tags are yours to word.
//   repo  → must be the exact GitHub repository name (the link is built from it)
//   live  → optional URL of a running deployment, or null
// Order here is the order on the page.

export const GITHUB_USER = 'Sharduljoshi2001';

export const FEATURED = [
  {
    title: 'WooCommerce → ERPNext integration',
    repo: 'woocommerce-erpnext-integration',
    description:
      'Node.js integration middleware connecting a WooCommerce store to ERPNext, so orders and records flow between the two systems without manual re-entry.',
    tags: ['Node.js', 'REST', 'Integration'],
    live: null,
  },
  {
    title: 'Store rating platform',
    repo: 'store-rating-application',
    description:
      'Full-stack app with role-based access control: users sign up and rate stores 1–5, admins and store owners manage operations. Node.js, Express and PostgreSQL in a 3-layer architecture.',
    tags: ['Node.js', 'Express', 'PostgreSQL', 'RBAC'],
    live: null,
  },
  {
    title: 'Collaborative task manager',
    repo: 'collaborative-task-manager',
    description:
      'Real-time, multi-user task management built with Express, PostgreSQL and Socket.IO, deployed and live.',
    tags: ['TypeScript', 'Express', 'PostgreSQL', 'Socket.IO'],
    live: 'https://collaborative-task-manager-livid.vercel.app',
  },
];
