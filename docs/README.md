# Q8 Documentation

Welcome to the Q8 Omni-Model Personal Assistant documentation. This directory contains comprehensive guides, specifications, and reference materials for developing and understanding the Q8 system.

## Documentation Structure

### Architecture
Deep dives into system design, data flow, and architectural decisions.

- [System Architecture](./architecture/system-architecture.md) - Overall system design and component interaction
- [Agent Swarm Architecture](./architecture/agent-swarm.md) - Multi-model orchestration design (8 agents)
- [Orchestration Engine](./architecture/orchestration-engine.md) - Router, handoffs, speculative execution, caching
- [AI Enhancement Plan](./architecture/ai-enhancement-plan.md) - Planned AI improvements and roadmap

### Development
Guides for developers working on Q8.

- [Backend Development Plan](./development/backend-development-plan.md) - Backend implementation roadmap
- [Frontend Development Plan](./development/frontend-development-plan.md) - Frontend implementation roadmap
- [Constitution & Protocols](./development/constitution-and-protocols.md) - Development rules and standards
- [Testing Guide](./development/testing-guide.md) - Vitest setup, mock patterns, running tests

### Guides
Step-by-step guides for common tasks.

- [Getting Started](./guides/getting-started.md) - Quick start guide

### Designs
Component design specifications.

- [Component Design Index](./designs/components/00-component-design-index.md) - Overview of all component designs
- [RxDB Integration Components](./designs/components/01-rxdb-integration-components.md) - Data & sync components
- [Authentication Components](./designs/components/02-authentication-components.md) - Auth & session components
- [Dashboard Widgets](./designs/components/03-dashboard-widgets.md) - Dashboard widget designs
- [Chat Interface Components](./designs/components/04-chat-interface-components.md) - Chat UI components
- [Voice Interface Enhancements](./designs/components/05-voice-interface-enhancements.md) - Voice interaction designs

### Plans
Implementation plans and improvement proposals.

- [Code Quality Improvements](./plans/2026-02-04-code-quality-improvements.md) - ESLint hardening, error handling
- [UX Optimization Plan](./UX-OPTIMIZATION-PLAN.md) - UX improvements roadmap

### Templates
Reusable templates for consistency.

- [Agent Template](./templates/agent-template.md) - New agent implementation template
- [Component Template](./templates/component-template.md) - React component template

### Reference
Reference materials and additional resources.

- [Glossary](./reference/glossary.md) - Terms and definitions
- [Tech Stack](./reference/tech-stack.md) - Technologies and versions

### Archive
Historical documents preserved for reference. These may contain outdated information.

- [Original README](./archive/original-readme.md) - Initial project documentation
- [Project Initialization](./archive/project-initialization.md) - Original setup script
- [Progress Template](./archive/progress-template.md) - Task tracking template
- [Master Build Specs](./archive/master-build-specs.md) - V3.0.0 specification (Nov 2025)

## Quick Links

**New to Q8?**
1. Start with [Getting Started](./guides/getting-started.md)
2. Review [System Architecture](./architecture/system-architecture.md)
3. See [CLAUDE.md](../CLAUDE.md) for Claude Code guidance

**Ready to develop?**
1. Check [Constitution & Protocols](./development/constitution-and-protocols.md)
2. Review [Backend](./development/backend-development-plan.md) or [Frontend](./development/frontend-development-plan.md) plans
3. Read the [Testing Guide](./development/testing-guide.md)

**Understanding the AI system?**
1. Review [Agent Swarm Architecture](./architecture/agent-swarm.md)
2. Deep-dive into the [Orchestration Engine](./architecture/orchestration-engine.md)
3. Check the [Agent Template](./templates/agent-template.md) for adding new agents

## Contributing to Documentation

When adding new documentation:

1. **Choose the right category:**
   - `architecture/` - System design and structure
   - `development/` - Development guides and processes
   - `guides/` - How-to guides and tutorials
   - `designs/` - Component and UI design specs
   - `plans/` - Implementation plans and proposals
   - `templates/` - Reusable templates
   - `reference/` - Reference materials
   - `archive/` - Outdated docs kept for historical reference

2. **Follow naming conventions:**
   - Use lowercase with hyphens: `my-guide-name.md`
   - Be descriptive: `adding-new-agents.md` not `agents.md`

3. **Update this README:**
   - Add your document to the appropriate section
   - Include a brief description

4. **Cross-reference:**
   - Link to related documents
   - Keep navigation easy

## External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [RxDB Documentation](https://rxdb.info/)
- [Supabase Documentation](https://supabase.com/docs)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Tailwind CSS](https://tailwindcss.com/docs)

## Support

- See [CLAUDE.md](../CLAUDE.md) for development guidelines
- Review the relevant guide or specification for your question
