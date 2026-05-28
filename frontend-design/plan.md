# Frontend Design Plan - 180DC VIT Chennai

## Tech Stack

- Vanilla TypeScript
- HTML5
- CSS3 (Vanilla)
- Bundler: Vite
- Package Manager: pnpm

## Color Palette Constraints

- **Backgrounds & Animations**: Green and White ONLY.
- **Text**: Black ONLY.

## Page Layout & Structure

### 1. Hero Section

- **Background**: White with a subtle, slow-pulse Green animated gradient blob.
- **Content**: Bold Black text introducing 180DC VIT Chennai.
- **Action Buttons**: Green borders with transparent backgrounds, Black text. On hover, background fills with Green, but text turns Black (or text styling flips, but keeping to constraints, we'll use strong black text on white/green contexts).

### 2. About Us

- **Background**: Solid Green.
- **Content**: White cards/containers that hold Black text describing the branch history, mission, and vision.

### 3. Latest Case Studies

- **Background**: Solid White.
- **Content**: Grid of project cards (White cards with thick Green borders).
- **Text**: Black headings and descriptions.
- **Animations**: Cards lift up slightly on hover with a Green shadow.

### 4. Leadership Team

- **Background**: Green.
- **Content**: Circular or rounded-rectangle profiles nested in White info cards.
- **Text**: Black titles (e.g., President, Director).

### 5. Blog Posts (New Module)

- **Background**: White.
- **Content**: A dedicated grid showcasing student/consultant blogs. Each blog card uses a Green background with a White inner container, containing Black text for the excerpt and title.
- **Interactivity**: Clicking "Read More" reveals the full post. (We will await specific requirements for the submission fields).

### 6. Partners

- **Background**: Green.
- **Content**: White banner strip sliding infinitely (animation) with partner logos or placeholders.

### 7. Footer

- **Background**: White.
- **Content**: Black text, Green hyperlinks for contact details and social media.
