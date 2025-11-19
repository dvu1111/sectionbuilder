# SectionBuilder Pro

**SectionBuilder Pro** is a professional-grade, browser-based structural analysis tool designed for civil and mechanical engineers. It calculates geometric properties for standard structural shapes and arbitrary custom polygons in real-time.

Built with **React**, **TypeScript**, and **D3.js**, it offers a CAD-like experience for defining cross-sections with support for complex geometries, curved segments, and voids (holes).

## 🚀 Features

### 1. Standard Shape Templates
Instant parametric analysis for common structural sections:
- **Rectangular** (Solid & Hollow)
- **Circular**
- **I-Shape** (W-Beams, S-Beams)
- **T-Shape**
- **Channel** (C-Shape)

### 2. Advanced Custom Drawing Engine
A fully interactive vector drawing environment allowing for:
- **Arbitrary Polygons:** Draw any closed shape.
- **Boolean Operations:** Define shapes as **Solids** (additive) or **Holes** (subtractive).
- **Curved Segments:** Convert straight lines into arcs using the **Bend** tool.
- **Vertex Editing:** Drag vertices, add new nodes, and refine geometry.
- **Transformations:** Rotate (90°) and Mirror (Horizontal/Vertical) complex shapes.

### 3. Real-Time Geometric Calculations
Automatically calculates the following properties:
- **Area (A)**
- **Centroid (Cy, Cz):** Visualized on the canvas.
- **Moment of Inertia (Iz, Iy, Izy):** About centroidal axes.
- **Section Modulus (S):** Elastic section moduli (Top, Bottom, Left, Right).
- **Plastic Modulus (Z):** Plastic section moduli (Approximate).
- **Radius of Gyration (rz, ry).**

## 🛠 Tech Stack

- **Framework:** React 18 (Vite)
- **Language:** TypeScript
- **Visualization & Math:** D3.js
- **Styling:** Tailwind CSS
- **Icons:** Lucide React

## 📦 Installation & Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/SectionBuilder.git
   cd SectionBuilder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```
   Open your browser to `http://localhost:5173`.

4. **Build for production**
   ```bash
   npm run build
   ```

## 📖 Usage Guide

### Custom Shape Mode
1. Select **Custom Shape** from the sidebar.
2. Choose a drawing tool:
   - **Poly:** Click points to define a shape. Double-click to close the loop.
   - **Circle:** Click center, drag to define radius.
3. **Solid vs. Hole:** Use the toggle in the control panel. "Holes" will subtract area and inertia from "Solids".
4. **Editing:**
   - **Select:** Drag points to move them.
   - **Add Node:** Click anywhere on a line segment to add a new vertex.
   - **Bend:** Click a straight line to turn it into a curve. Drag the purple control handle to adjust the radius.

### Standard Templates
1. Select a shape from the sidebar.
2. Modify dimensions (Depth, Width, Thickness) in the right-hand Control Panel.
3. The canvas updates in real-time.

## 🧮 Mathematical Implementation

- **Standard Shapes:** Uses exact engineering formulas and the **Parallel Axis Theorem** to combine constituent parts (e.g., I-Beams are treated as 3 rectangles).
- **Custom Shapes:** Uses **Green's Theorem** (Polygon Integrals) to calculate properties by traversing the perimeter of the shape.
- **Curves:** Curved segments are discretized into small linear approximations to allow Green's Theorem to function accurately on arcs.

## 🚀 Deployment

This project is configured for automated deployment to **GitHub Pages**.
1. Push to the `main` or `master` branch.
2. The GitHub Action in `.github/workflows/deploy.yml` will automatically build and deploy the app.

## 📄 License

MIT
