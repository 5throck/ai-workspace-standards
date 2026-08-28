# UI/UX Design System v6.0 (AIG Onyx 2.0)

This document defines the **Strategic Financial Aesthetics (SFA)**, design tokens, and components to maintain the premium visual identity and professional-grade UX of the **AIG Platform**.

---

## 1. Design Philosophy: SFA (Strategic Financial Aesthetics)

1.  **Expert Density (Strategic Density)**: Information must be dense but legible. Optimize margins and component widths for a **21-inch (1920x1080)** baseline. Avoid "white-space-only" designs; prefer meaningful information distribution.
2.  **Visual Proof of Trust**: Numbers are the core. Use **JetBrains Mono** with `tabular-nums` for all financial data to ensure vertical alignment.
3.  **Abyssal Depth (Onyx Aesthetics)**: Use an ultra-dark background (`Onyx Black`) with high-contrast glassmorphism and HSL-based vibrant accents.

---

## 2. Visual Tokens & Color System (HSL)

We've pivoted to an HSL-based system for precise control over saturation and alpha transparency.

### 2.1. Base Palette
- **Background (Onyx)**: `hsl(240, 10%, 4%)`
- **Surface (Card base)**: `hsl(240, 10%, 8%)`
- **Surface Elevated**: `hsl(240, 10%, 12%)`
- **Border**: `hsla(0, 0%, 100%, 0.08)`

### 2.2. Accent Palette
- **Primary (Strategic Blue)**: `hsl(217, 91%, 60%)`
- **Success (Emerald Profit)**: `hsl(158, 64%, 52%)`
- **Warning (Amber Risk)**: `hsl(45, 93%, 47%)`
- **Danger (Rose Loss)**: `hsl(346, 84%, 61%)`
- **Information (Cyan Insight)**: `hsl(188, 86%, 53%)`

---

## 3. Typography & Layout

### 3.1. Standard Typography
| Target | Font Family | Size / Weight | Case / Tracking |
|---|---|---|---|
| **Headings (H1/H2)** | `Inter` | 1.5rem~2rem / 900 | UPPERCASE / -0.02em |
| **Body (Default)** | `Pretendard`, `Inter` | 0.875rem / 400 | Sentence / 0.01em |
| **Financial Figures** | `JetBrains Mono` | Variable / 700 | `tabular-nums` |
| **Sub-Labels** | `Inter` | 10px / 900 | UPPERCASE / 0.2em |

### 3.2. Layout Architecture
- **Target Size**: Optimized for **21-inch Monitor (1920px)**.
- **Main Container**: `max-width: 1840px` with `40px` side padding.
- **Independent Scrolling**:
    - **Sidebar (L)**: `h-[calc(100vh-3.5rem)]`, `overflow-y-auto`, `fixed` or `sticky`.
    - **Main Content (R)**: `h-[calc(100vh-3.5rem)]`, `overflow-y-auto`.
    - This separation ensures contextual navigation remains static while content flows.

---

## 4. Components Standardization

### 4.1. Strategic Data Card
- **Radius**: `var(--radius-3xl)` (24px)
- **Glass Effect**: `backdrop-blur(24px)` + `bg-surface/70`
- **Border Accent**: Left-side accent border (2px) matching the category color (Blue for Sales, Emerald for Profit).

### 4.2. Precision Floating Inputs
- **Radius**: `var(--radius-xl)` (16px)
- **Active State**: Inner shadow glow + `var(--primary)` outline.
- **Formatting**: Tabular numbers for input transparency.

---

## 5. Iconography & Imagery

- **Icons**: [Lucide-React] 20px monochrome set. Stroke width: `1.5`.
- **Images**:
    - **Category**: Abstract Financial visualizations.
    - **Source**: AI-Generated (Onyx style) or SVG-based minimalist shapes.
    - **Constraint**: Must use the HSL accent colors for highlights.

---
*Document Version: 6.0 | Owner: UXVG Design Lead*
