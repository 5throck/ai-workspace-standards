---
name: ui-ux-design-intelligence
description: >
  Provides comprehensive UI/UX design capabilities including design system creation,
  component design, visual hierarchy, and user-centered design principles. Use when:
  building design systems, creating visual designs, designing UI components, or establishing
  design specifications.
version: 1.0.0
scope: co-design
status: active
owner: pm
last_reviewed: 2026-07-19
prerequisites: none
gemini-parity: skip
metadata:
  type: implementation
  triggers:
    - design system
    - ui design
    - ux design
    - component design
    - visual design
    - design tokens
    - interface design
---

## Context

This skill provides end-to-end UI/UX design capabilities, from design system architecture through component specification. It combines design thinking, visual design principles, and systematic approaches to create cohesive, scalable user interfaces.

## When to Use

**Design System Creation:**
- Trigger: "Create design system" or "Establish design tokens"
- Use Case: Starting new project or redesigning existing system

**Component Design:**
- Trigger: "Design component" or "Create UI element"
- Use Case: Building individual interface components with specifications

**Visual Design:**
- Trigger: "Design interface" or "Create visual layout"
- Use Case: Creating screen designs, layouts, or visual compositions

**Design Specification:**
- Trigger: "Specify design" or "Create design documentation"
- Use Case: Documenting design decisions for handoff to developers

---

## Execution Steps

## Step 1: Design System Architecture

**Purpose**: Establish foundational design system structure.

**Design Token Definition**:
1. **Color System**:
   - Primary colors (brand colors)
   - Secondary colors (supporting colors)
   - Semantic colors (success, warning, error, info)
   - Neutral colors (grays for text, backgrounds, borders)
   - Define color values in HEX, RGB, HSL formats

2. **Typography Scale**:
   - Font families (primary, secondary, code)
   - Type scale (heading sizes, body sizes, caption sizes)
   - Font weights (light, regular, medium, semibold, bold)
   - Line height ratios (body: 1.5-1.7, headings: 1.1-1.3)
   - Letter spacing for different sizes

3. **Spacing System**:
   - Base unit (typically 4px or 8px)
   - Spacing scale (4, 8, 12, 16, 24, 32, 48, 64, 96 pixels)
   - Consistent padding and margins
   - Component spacing rules

4. **Border Radius**:
   - Scale for corner radii (0, 4, 8, 16, 24 pixels)
   - Usage guidelines for each radius size
   - Special cases (circles, pills)

5. **Shadows & Elevation**:
   - Elevation levels (flat, raised, overlay, modal)
   - Shadow definitions for each level
   - Usage contexts

**Output**: Design token documentation with all token categories

---

## Step 2: Component Design Principles

**Purpose**: Create systematic approach to component design.

**Component Design Process**:
1. **Identify Component Purpose**:
   - What user problem does it solve?
   - In what contexts will it be used?
   - What are the accessibility requirements?

2. **Define Component States**:
   - Default state
   - Hover state
   - Focus state (keyboard navigation)
   - Active/pressed state
   - Disabled state
   - Error/invalid state

3. **Design Component Variants**:
   - Size variants (small, medium, large)
   - Importance variants (primary, secondary, tertiary)
   - Context variants (contained, outlined, text)

4. **Specify Component Behavior**:
   - Interaction patterns
   - Animation transitions
   - Responsive behavior
   - Edge cases

**Output**: Component specification sheet with all states and variants

---

## Step 3: Visual Hierarchy & Layout

**Purpose**: Establish clear visual hierarchy and layout systems.

**Hierarchy Principles**:
1. **Size Hierarchy**:
   - Establish clear size relationships (H1 > H2 > H3 > body)
   - Use modular scale for consistent sizing
   - Ensure visual distinction between levels

2. **Color Hierarchy**:
   - Primary actions: high contrast, prominent color
   - Secondary actions: medium contrast, supporting color
   - Tertiary actions: low contrast, minimal color
   - De-emphasized actions: neutral/monochrome

3. **Spacing Hierarchy**:
   - More whitespace = more importance
   - Group related elements with less spacing
   - Separate unrelated elements with more spacing
   - Establish vertical rhythm

4. **Layout Systems**:
   - Grid system (columns, gutters, margins)
   - Breakpoints for responsive design
   - Container max-widths
   - Component spacing rules

**Output**: Layout system documentation with hierarchy guidelines

---

## Step 4: Accessibility & WCAG Compliance

**Purpose**: Ensure designs meet accessibility standards.

**Accessibility Checklist**:
1. **Color Contrast**:
   - Text contrast ratio: 4.5:1 (AA) for body text
   - Large text contrast ratio: 3:1 (AA) for 18pt+
   - Graphic contrast ratio: 3:1 (AA) for UI components
   - Test with contrast checker tools

2. **Touch Targets**:
   - Minimum size: 44×44 CSS pixels (WCAG AAA)
   - Recommended size: 48×48 CSS pixels
   - Spacing between touch targets: 8px minimum

3. **Typography**:
   - Base font size: 16px minimum (100%)
   - Scalable text units (rem, em, %)
   - Line height: 1.5-1.7 for body text
   - Paragraph spacing: 1.5× line height

4. **Keyboard Navigation**:
   - Visible focus indicators
   - Logical tab order
   - Skip navigation links
   - No keyboard traps

5. **Screen Reader Support**:
   - Semantic HTML elements
   - ARIA labels where needed
   - Alt text for images
   - Meaningful link text

**Output**: Accessibility compliance report with remediation steps

---

## Step 5: Design Documentation & Handoff

**Purpose**: Create comprehensive design specifications for implementation.

**Documentation Structure**:
1. **Component Specification**:
   - Component name and purpose
   - Visual examples (all states and variants)
   - Design tokens used
   - Spacing and positioning
   - Interaction behaviors
   - Code examples (CSS, design tokens)

2. **Layout Specifications**:
   - Grid system documentation
   - Responsive breakpoints
   - Container behaviors
   - Spacing utilities

3. **Usage Guidelines**:
   - When to use the component
   - When NOT to use the component
   - Do's and don'ts
   - Common mistakes to avoid

4. **Implementation Notes**:
   - Technical considerations
   - Browser compatibility notes
   - Performance considerations
   - Accessibility requirements

**Output**: Complete design handoff package with specifications and examples

---

## Step 6: Design Quality Validation

**Purpose**: Ensure design meets quality standards and best practices.

**Validation Checklist**:
- [ ] All design tokens defined and documented
- [ ] Component states are complete (default, hover, focus, active, disabled)
- [ ] Color contrast meets WCAG AA standards
- [ ] Touch targets meet minimum size requirements
- [ ] Typography uses proper hierarchy and scale
- [ ] Layout follows grid system
- [ ] Spacing follows spacing system
- [ ] Components work responsively
- [ ] Accessibility considerations addressed
- [ ] Design documentation is complete
- [ ] Implementation examples provided

**Quality Gates**:
1. **Design System Review**: All tokens defined systematically
2. **Component Review**: All components have complete specifications
3. **Accessibility Review**: WCAG AA compliance verified
4. **Documentation Review**: Handoff documentation is complete

**Output**: Design quality report with pass/fail status and recommendations

---

## Output Format

**For Design System Creation**:
- Complete design token system (color, typography, spacing, borders, shadows)
- Design system documentation
- Component library structure
- Usage guidelines

**For Component Design**:
- Component specification sheet
- Visual examples for all states and variants
- Design token mappings
- Implementation code examples
- Accessibility compliance report

**For Visual Design**:
- Layout compositions
- Visual hierarchy documentation
- Responsive design specifications
- Grid system documentation

---

## Best Practices

**Design System Design**:
✅ **Do**:
- Start with tokens before components
- Use systematic approaches (scales, ratios)
- Document all decisions and rationale
- Test with real content and scenarios
- Iterate based on feedback

❌ **Don't**:
- Design components without system context
- Skip documentation ("self-documenting" doesn't scale)
- Ignore accessibility or responsive design
- Create arbitrary values without system
- Mix metaphors or paradigms

**Component Design**:
✅ **Do**:
- Design for all states upfront
- Consider accessibility from the start
- Use design tokens consistently
- Think about responsive behavior
- Create reusable patterns

❌ **Don't**:
- Design only the "happy path"
- Add visual treatments arbitrarily
- Hard-code values instead of using tokens
- Ignore mobile or different screen sizes
- Create one-off components without system

---

## Common Mistakes to Avoid

**Design System Anti-Patterns**:
1. **Pixel Perfect Fixation**: Obsessing over exact pixels instead of systematic relationships
2. **Token Explosion**: Creating too many overly-specific tokens
3. **Component Sprawl**: Designing every possible variant instead of flexible components
4. **Documentation Debt**: Letting documentation fall out of sync with designs
5. **Accessibility Afterthought**: Treating accessibility as optional instead of foundational

**Component Design Anti-Patterns**:
1. **State Explosion**: Creating too many state combinations
2. **Hard-Coded Values**: Not using design tokens
3. **Mobile Neglect**: Designing only for desktop
4. **Inconsistency**: Not following established patterns
5. **Over-Engineering**: Making components too complex

---

## Related Skills

- **service-design**: For broader service experience design
- **typography-expert**: For specialized font and type system design
- **accessibility-review**: For detailed accessibility auditing

---

## Design Tools Integration

**Figma**:
- Use design token variables
- Create component variants properly
- Document components with descriptions
- Use auto-layout for responsive components

**Design Token Formats**:
- Style Dictionary format
- CSS Custom Properties
- Design Tokens JSON
- Figma Variables

**Handoff Formats**:
- Figma Dev Mode
- Zeplin
- Design token exports
- Code snippets (CSS, React, etc.)
