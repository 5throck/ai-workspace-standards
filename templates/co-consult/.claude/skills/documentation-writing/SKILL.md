---
name: documentation-writing
description: >
  Creates clear, accessible documentation and communications for diverse audiences.
  Use when: writing guides, creating documentation, drafting communications, or synthesizing
  complex information for technical and non-technical audiences.
version: 1.0.0
gemini-parity: skip
metadata:
  type: implementation
  triggers:
    - write documentation
    - create guide
    - draft communication
    - write manual
    - create tutorial
    - documentation
    - technical writing
---

## Overview

This skill provides comprehensive documentation writing capabilities, from technical guides to user-friendly manuals. It ensures documentation is clear, well-structured, accessible, and appropriately targeted to the intended audience.

## When to Use This Skill

**Technical Documentation**:
- Trigger: "Write technical documentation" or "Create API reference"
- Use Case: Documenting technical systems, APIs, or code

**User Guides**:
- Trigger: "Create user guide" or "Write manual"
- Use Case: Helping end users understand and use products or features

**Process Documentation**:
- Trigger: "Document process" or "Create workflow guide"
- Use Case: Explaining how to complete tasks or procedures

**Communications**:
- Trigger: "Draft announcement" or "Write communication"
- Use Case: Sharing information with stakeholders or teams

---

## Step 1: Audience Analysis

**Purpose**: Understand who will read the documentation and their needs.

**Audience Assessment**:
1. **Technical Level**:
   - Technical experts (developers, engineers)
   - Technical users (power users, administrators)
   - Non-technical users (end users, general audience)
   - Mixed audiences

2. **Knowledge Base**:
   - What prior knowledge do they have?
   - What terminology will they understand?
   - What concepts need explanation?
   - What examples will resonate?

3. **Use Context**:
   - When will they use this documentation?
   - What problem are they trying to solve?
   - What's their urgency or stress level?
   - What format do they prefer?

4. **Accessibility Needs**:
   - Language requirements (English, Korean, multi-language)
   - Reading level considerations
   - Format preferences (visual, text, interactive)
   - Disability accommodations

**Output**: Audience profile with characteristics and needs

---

## Step 2: Information Architecture

**Purpose**: Structure documentation for clarity and navigation.

**Structuring Principles**:
1. **Hierarchical Organization**:
   - Overview → Details → Reference
   - High-level concepts → Specific tasks
   - General information → Edge cases

2. **Progressive Disclosure**:
   - Start with essentials
   - Reveal complexity gradually
   - Link to detailed information
   - Provide multiple depth levels

3. **Logical Flow**:
   - Chronological (step-by-step processes)
   - Task-based (common user goals)
   - Conceptual (building understanding)
   - Reference (alphabetical, searchable)

4. **Navigation Design**:
   - Table of contents
   - Section headers and subheaders
   - Cross-references and links
   - Index or search keywords

**Common Documentation Structures**:
- **Getting Started Guide**: Setup → First steps → Common tasks
- **User Manual**: Overview → Features → Instructions → Reference
- **Technical Guide**: Architecture → Implementation → API → Examples
- **Troubleshooting**: Symptoms → Causes → Solutions → Prevention

**Output**: Documentation outline with structure and flow

---

## Step 3: Content Creation

**Purpose**: Write clear, actionable content.

**Writing Principles**:
1. **Clarity First**:
   - Use simple, direct language
   - One idea per sentence
   - Active voice over passive
   - Specific over general

2. **Accessibility**:
   - Define technical terms on first use
   - Provide examples and analogies
   - Use visual aids (diagrams, screenshots)
   - Consider non-native speakers

3. **Actionability**:
   - Start with verbs for instructions
   - Provide step-by-step procedures
   - Include expected results
   - Add troubleshooting guidance

4. **Scannability**:
   - Use bullet points and lists
   - Highlight important information
   - Break text into short paragraphs
   - Use descriptive headers

**Content Types**:
1. **Procedural Content**:
   - Step-by-step instructions
   - Numbered lists for sequences
   - Conditional steps (if/then)
   - Warnings and cautions

2. **Conceptual Content**:
   - Explanations and definitions
   - Examples and use cases
   - Diagrams and illustrations
   - Analogies and comparisons

3. **Reference Content**:
   - Tables and matrices
   - Code examples and snippets
   - Configuration options
   - Error messages and solutions

**Output**: Complete documentation content with clear structure

---

## Step 4: Visual Communication

**Purpose**: Enhance understanding with visual elements.

**Visual Design Guidelines**:
1. **Diagrams and Flowcharts**:
   - Use for processes and workflows
   - Keep simple and focused
   - Label all elements clearly
   - Include legends if needed

2. **Screenshots and Images**:
   - Show actual interface elements
   - Highlight important areas
   - Add annotations and callouts
   - Maintain consistent style

3. **Tables and Charts**:
   - Organize complex information
   - Use clear headers and labels
   - Highlight key data points
   - Provide context and interpretation

4. **Code Examples**:
   - Show working examples
   - Add comments explaining code
   - Use syntax highlighting
   - Include expected output

**Visual Accessibility**:
- Provide text alternatives (alt text)
- Ensure sufficient color contrast
- Use readable fonts and sizes
- Consider color blindness

**Output**: Visual elements that enhance understanding

---

## Step 5: Review and Refine

**Purpose**: Ensure documentation meets quality standards.

**Quality Checklist**:
- [ ] Content is accurate and complete
- [ ] Structure is logical and navigable
- [ ] Language is clear and accessible
- [ ] Examples are relevant and helpful
- [ ] Visual aids support understanding
- [ ] Formatting is consistent
- [ ] Cross-references work correctly
- [ ] Technical terms are defined
- [ ] Instructions are actionable
- [ ] Troubleshooting covers common issues

**Testing Methods**:
1. **Usability Testing**:
   - Have users follow documentation
   - Observe where they get stuck
   - Ask for feedback on clarity
   - Test with diverse users

2. **Technical Review**:
   - Subject matter expert review
   - Technical accuracy verification
   - Completeness check
   - Edge case coverage

3. **Editorial Review**:
   - Grammar and spelling check
   - Style guide consistency
   - Formatting verification
   - Link testing

**Output**: Refined documentation with quality assurance

---

## Step 6: Publishing and Maintenance

**Purpose**: Make documentation available and keep it current.

**Publishing Considerations**:
1. **Format Selection**:
   - Markdown (for version control and collaboration)
   - HTML (for web publishing)
   - PDF (for offline reading and printing)
   - Interactive (for tutorials and guides)

2. **Distribution**:
   - Documentation sites (GitBook, ReadTheDocs)
   - Wikis and knowledge bases
   - Inline help and tooltips
   - Print manuals

3. **Version Control**:
   - Track documentation versions
   - Maintain change logs
   - Archive outdated versions
   - Tag documentation releases

4. **Maintenance**:
   - Review schedule (quarterly, per release)
   - Update procedures
   - Feedback collection
   - Accuracy verification

**Maintenance Tasks**:
- Update for product changes
- Revise based on user feedback
- Add new FAQs and troubleshooting
- Remove or archive outdated content
- Update screenshots and examples

**Output**: Published documentation with maintenance plan

---

## Expected Outputs

**For Technical Documentation**:
- API references with parameters and responses
- Architecture documentation with diagrams
- Setup and installation guides
- Configuration references
- Troubleshooting guides

**For User Documentation**:
- Getting started guides
- Feature explanations
- How-to tutorials
- FAQ sections
- Best practices guides

**For Process Documentation**:
- Workflow descriptions
- Procedure manuals
- Training materials
- Onboarding guides
- Standard operating procedures

---

## Best Practices

**Writing Quality**:
✅ **Do**:
- Write for your specific audience
- Use simple, direct language
- Provide examples and context
- Include visual aids
- Test with actual users
- Update regularly

❌ **Don't**:
- Assume prior knowledge
- Use jargon without explanation
- Create walls of text
- Skip visual formatting
- Write for "everyone" (be specific)
- Set and forget documentation

**Structure Quality**:
✅ **Do**:
- Start with overview
- Use progressive disclosure
- Provide multiple navigation paths
- Include cross-references
- Add search keywords
- Create scannable content

❌ **Don't**:
- Bury important information
- Create deep hierarchies
- Make users read everything
- Use ambiguous headers
- Ignore different learning styles
- Write monolithic documents

---

## Common Mistakes to Avoid

**Content Anti-Patterns**:
1. **Information Dump**: Including everything without organization
2. **Assumption Trap**: Assuming reader knows what you know
3. **Tone Mismatch**: Too formal or too casual for audience
4. **Update Neglect**: Letting documentation become outdated
5. **Missing Context**: Focusing on what without explaining why

**Structure Anti-Patterns**:
1. **Poor Organization**: Illogical flow or grouping
2. **Navigation Fail**: Difficult to find specific information
3. **Inconsistency**: Different styles or formats in same doc
4. **Gaps**: Missing steps or important information
5. **Overcompleteness**: Including unnecessary detail

---

## Related Skills

- **research-analysis**: For gathering information to document
- **technical-writing**: For specialized technical documentation
- **accessibility-review**: For ensuring documentation accessibility
- **visual-design**: For creating effective diagrams and visual aids

---

## Documentation Tools

**Authoring Tools**:
- Markdown editors (Typora, VS Code, Obsidian)
- Documentation generators (Jekyll, Hugo, Docusaurus)
- Wiki platforms (Confluence, Notion, GitBook)
- Content management systems

**Collaboration Tools**:
- Version control (Git)
- Review tools (GitHub PRs, Google Docs comments)
- Style guides (Google Developer Documentation Style Guide)
- Editorial calendars

**Publishing Platforms**:
- Static site generators (MkDocs, Docusaurus)
- Documentation hosting (GitBook, ReadTheDocs)
- Knowledge bases (Confluence, Notion)
- Versioned documentation (Git-backed)

**Quality Tools**:
- Grammar checkers (Grammarly, LanguageTool)
- Link checkers (broken link detectors)
- SEO tools (for public documentation)
- Analytics (user engagement tracking)
