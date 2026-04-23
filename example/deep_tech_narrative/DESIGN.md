---
name: Deep Tech Narrative
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#41484c'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#71787c'
  outline-variant: '#c1c7cc'
  surface-tint: '#3c6376'
  primary: '#002532'
  on-primary: '#ffffff'
  primary-container: '#0d3b4c'
  on-primary-container: '#7da5b9'
  inverse-primary: '#a4cce1'
  secondary: '#006b5f'
  on-secondary: '#ffffff'
  secondary-container: '#6df5e1'
  on-secondary-container: '#006f64'
  tertiary: '#321d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#4f3000'
  on-tertiary-container: '#de8e00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bfe9fe'
  primary-fixed-dim: '#a4cce1'
  on-primary-fixed: '#001f2a'
  on-primary-fixed-variant: '#224c5d'
  secondary-fixed: '#71f8e4'
  secondary-fixed-dim: '#4fdbc8'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005048'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  h1:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: '0'
  mono-data:
    fontFamily: monospace
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  sidebar-width: 260px
  sidebar-collapsed: 72px
  gutter: 16px
  container-padding: 24px
  stack-tight: 8px
  stack-loose: 20px
---

## Brand & Style

The design system is engineered for high-utility enterprise management of conversational AI. It centers on a **Corporate Modern** aesthetic infused with **Glassmorphism** to reflect a state-of-the-art technological foundation. The personality is authoritative and calm, ensuring that users managing complex, high-volume communication feel in control. 

The visual language balances high data density with visual breathing room, using translucent layers and precise geometry to organize complex chatbot configurations and real-time messaging streams. The result is a workspace that feels like a mission control center—efficient, reliable, and sophisticated.

## Colors

The palette is anchored by **Deep Marine Blue** (#0D3B4C) to establish trust and stability, paired with **Teal** (#14B8A6) for primary actions and technical highlights. This combination distinguishes the platform from generic social tools, positioning it as a professional utility.

For status indicators, we use high-saturation tokens: **Emerald Green** for active states and **Amber** for transient or connecting states. The background strategy utilizes cool grays to keep the focus on content, while glass-like surfaces use semi-transparent whites with backdrop blurs to maintain depth without clutter.

## Typography

The design system utilizes **Inter** exclusively to capitalize on its exceptional legibility in data-heavy environments. To handle the high density of chat logs and configuration settings, the system leans heavily on a 14px base for body text and 13px for secondary meta-data.

Visual hierarchy is maintained through weight rather than dramatic size shifts. All-caps labels with increased letter spacing are reserved for category headers and status tags, ensuring they remain distinct from conversational content.

## Layout & Spacing

The design system follows a **12-column fluid grid** for configuration dashboards, transitioning to a **fixed-pane layout** for chat views. The sidebar is the primary navigation anchor, occupying 260px on desktop and collapsing to a 72px icon-only rail on smaller screens or by user preference.

Data density is achieved by using an 8px spacing rhythm for structural elements and a 4px rhythm for internal component alignment. In chat views, messages are grouped with tight 4px vertical spacing to maximize the visible history, while configuration forms use a 20px vertical stack to prevent input fatigue.

## Elevation & Depth

Depth in this design system is achieved through **Glassmorphism** and **Ambient Shadows**. Surfaces are tiered to represent functional hierarchy:
- **Base Level:** Solid neutral light gray (#F8FAFC) for the canvas.
- **Mid Level:** Glass-morphic cards with a `blur(12px)` and `rgba(255, 255, 255, 0.7)` background. This is used for the sidebar and secondary navigation panes.
- **Top Level:** Elements like modals and active chat bubbles use a subtle, diffused shadow (12% opacity, 15px blur) with a slight teal tint to suggest light refraction.

Borders are kept ultra-thin (1px) and low-contrast (#E2E8F0) to define edges without adding visual weight.

## Shapes

The design system employs **Soft** roundedness. Standard components like buttons and input fields use a 0.25rem (4px) radius to maintain a professional, sharp look. Larger containers such as cards and chat panels use a 0.5rem (8px) radius to soften the high-tech aesthetic and make the interface more approachable. 

Chat bubbles use a distinct asymmetrical rounding: 12px on three corners and 2px on the corner pointing toward the sender, creating a clear directional cue for conversational flow.

## Components

### Navigation & Sidebar
The sidebar uses high-contrast icons with a "glow-active" state. When a menu item is active, it displays a 3px teal vertical indicator on the left and a subtle background gradient.

### Buttons & Inputs
- **Primary Buttons:** Solid Teal (#14B8A6) with white text. 
- **Secondary Buttons:** Ghost style with Teal borders and text.
- **Inputs:** Minimalist bottom-border focus style or fully enclosed with a 1px light gray border. Focus states must use a 2px teal outer ring.

### Chat & Messaging
- **System Bubbles:** Centered, semi-transparent gray with 11px uppercase text.
- **User/Bot Bubbles:** Bot messages use the Primary Blue; user messages use a neutral light teal. 
- **Status Chips:** Small, pill-shaped indicators with a leading dot for "Online" or "Connecting" states.

### Data Configuration
- **Property Sheets:** Use a two-column key-value pair layout with a 1px divider.
- **Code Blocks:** For webhook or JSON configuration, use a dark-themed mono-space container with 8px rounded corners to differentiate "technical configuration" from "user UI."