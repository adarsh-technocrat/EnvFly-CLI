# EnvFly CLI Documentation

This directory contains the documentation for EnvFly CLI, built with [Mintlify](https://mintlify.com/).

## 🚀 Quick Start

### Local Development

1. **Install Mintlify CLI**

   ```bash
   npm install -g mintlify
   ```

2. **Start the development server**

   ```bash
   mintlify dev
   ```

3. **Open your browser**
   Navigate to `http://localhost:3000`

### Deploy to Production

1. **Connect your repository to Mintlify**

   - Go to [Mintlify Dashboard](https://app.mintlify.com/)
   - Connect your GitHub repository
   - Mintlify will automatically deploy your docs

2. **Custom domain (optional)**
   - Configure your custom domain in Mintlify dashboard
   - Update DNS records as instructed

## 📁 File Structure

```
docs/
├── mint.json                 # Mintlify configuration
├── introduction.mdx          # Landing page
├── getting-started.mdx       # Quick start guide
├── installation.mdx          # Installation instructions
├── commands/                 # CLI command documentation
│   ├── init.mdx
│   ├── login.mdx
│   ├── list.mdx
│   ├── push.mdx
│   ├── pull.mdx
│   ├── sync.mdx
│   ├── team.mdx
│   ├── history.mdx
│   └── audit.mdx
├── concepts/                 # Core concepts
│   ├── environments.mdx
│   ├── storage-providers.mdx
│   ├── teams.mdx
│   └── security.mdx
├── providers/                # Storage provider guides
│   ├── git.mdx
│   ├── aws.mdx
│   ├── azure.mdx
│   ├── google.mdx
│   └── envfly-cloud.mdx
├── configuration/            # Configuration guides
│   ├── envfly-file.mdx
│   ├── environment-variables.mdx
│   └── encryption.mdx
├── api/                      # API reference
│   ├── authentication.mdx
│   ├── teams.mdx
│   ├── environments.mdx
│   └── projects.mdx
├── deployment/               # Deployment guides
│   ├── backend-setup.mdx
│   ├── azure-deployment.mdx
│   ├── aws-deployment.mdx
│   └── docker.mdx
├── examples/                 # Example projects
│   ├── nodejs-project.mdx
│   ├── react-app.mdx
│   └── microservices.mdx
└── assets/                   # Images and other assets
    ├── logo/
    │   ├── dark.svg
    │   └── light.svg
    ├── hero-image.png
    └── favicon.svg
```

## 🎨 Customization

### Colors and Branding

Edit `mint.json` to customize:

```json
{
  "colors": {
    "primary": "#3B82F6",
    "light": "#60A5FA",
    "dark": "#1D4ED8"
  },
  "logo": {
    "dark": "/logo/dark.svg",
    "light": "/logo/light.svg"
  }
}
```

### Navigation

Update the navigation structure in `mint.json`:

```json
{
  "navigation": [
    {
      "group": "Get Started",
      "pages": ["introduction", "getting-started", "installation"]
    }
  ]
}
```

### Components

Mintlify provides many built-in components:

- `<Hero>` - Landing page hero section
- `<Card>` - Information cards
- `<Grid>` - Responsive grid layouts
- `<Callout>` - Info, warning, and error messages
- `<Steps>` - Step-by-step guides
- `<AccordionGroup>` - Collapsible content
- `<Mermaid>` - Diagrams and flowcharts

## 📝 Writing Guidelines

### File Structure

Each documentation page should have:

```mdx
---
title: "Page Title"
description: "Brief description for SEO"
---

# Main Heading

Content goes here...
```

### Code Examples

Use syntax highlighting:

```bash
# Shell commands
npm install -g envfly-cli
```

```javascript
// JavaScript examples
const config = {
  version: "1.0",
  project_name: "my-app",
};
```

```json
{
  "version": "1.0",
  "project_name": "my-app"
}
```

### Components Usage

```mdx
<Callout type="info">This is an informational callout.</Callout>

<Grid cols={2}>
  <Card title="Feature 1">Description of feature 1.</Card>
  <Card title="Feature 2">Description of feature 2.</Card>
</Grid>
```

## 🔧 Configuration

### mint.json

The main configuration file includes:

- **Site metadata**: Name, description, colors
- **Navigation**: Page structure and grouping
- **Social links**: GitHub, Discord, etc.
- **Custom components**: Logo, favicon, etc.

### Environment Variables

For local development, you can set:

```bash
MINTLIFY_API_KEY=your_api_key
MINTLIFY_SITE_ID=your_site_id
```

## 🚀 Deployment

### Automatic Deployment

Mintlify automatically deploys when you push to the main branch.

### Manual Deployment

```bash
# Build and deploy
mintlify build
mintlify deploy
```

### Preview Deployments

For pull requests, Mintlify creates preview deployments automatically.

## 📊 Analytics

Mintlify provides built-in analytics:

- Page views and unique visitors
- Search queries and popular pages
- User journey tracking
- Performance metrics

## 🔍 SEO

### Meta Tags

Each page can have custom meta tags:

```mdx
---
title: "Page Title"
description: "SEO description"
keywords: "envfly, cli, environment variables"
---
```

### Sitemap

Mintlify automatically generates a sitemap.xml file.

## 🛠️ Development

### Adding New Pages

1. Create a new `.mdx` file
2. Add frontmatter with title and description
3. Update `mint.json` navigation
4. Write content using Markdown and components

### Styling

Custom CSS can be added in `mint.json`:

```json
{
  "css": "/styles/custom.css"
}
```

### Custom Components

For advanced customization, you can create custom React components.

## 📚 Resources

- [Mintlify Documentation](https://docs.mintlify.com/)
- [Mintlify Components](https://docs.mintlify.com/components)
- [Mintlify Configuration](https://docs.mintlify.com/configuration)
- [Mintlify Deployment](https://docs.mintlify.com/deployment)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `mintlify dev`
5. Submit a pull request

## 📄 License

This documentation is licensed under the same license as the main project (ISC).

---

**Need help?** Check out the [Mintlify documentation](https://docs.mintlify.com/) or join our [Discord community](https://discord.gg/envfly).
