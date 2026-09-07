const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Initialize PDF Document
const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 60, left: 50, right: 50 },
  bufferPages: true
});

const outputPath = path.join(__dirname, '../whatsapp_bot_documentation.pdf');
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// Premium Color Palette
const COLORS = {
  primary: '#1E3A8A',    // Deep Navy Blue
  secondary: '#0F766E',  // Rich Teal
  darkText: '#1F2937',   // Slate Charcoal
  lightGray: '#F9FAFB',  // Clean light gray for tables
  divider: '#E5E7EB',    // Border line color
  white: '#FFFFFF',
  muted: '#4B5563'       // Muted gray
};

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique'
};

// Global Y Tracker
let currentY = 50;

// Header & Footer Drawing Function
function drawHeaderFooter(pageNumber, totalPages) {
  if (pageNumber === 1) return; // Skip cover page

  // Header
  doc.save();
  doc.fontSize(8)
     .font(FONTS.bold)
     .fillColor(COLORS.secondary)
     .text('SYSTEM DOCUMENTATION', 50, 25, { lineBreak: false });

  doc.font(FONTS.regular)
     .fillColor(COLORS.muted)
     .text('WhatsApp Automation Bot Platform', 180, 25, { align: 'right', width: 365, lineBreak: false });
  
  doc.moveTo(50, 36)
     .lineTo(545, 36)
     .lineWidth(0.5)
     .strokeColor(COLORS.divider)
     .stroke();
  doc.restore();

  // Footer
  doc.save();
  doc.moveTo(50, 785)
     .lineTo(545, 785)
     .lineWidth(0.5)
     .strokeColor(COLORS.divider)
     .stroke();
  doc.restore();
}

// Render Cover Page
function renderCoverPage() {
  // Decorative side accents
  doc.rect(0, 0, 15, 842).fill(COLORS.primary);
  doc.rect(15, 0, 8, 842).fill(COLORS.secondary);

  // Main Title
  doc.fillColor(COLORS.primary);
  doc.font(FONTS.bold).fontSize(32).text('WHATSAPP AUTOMATION', 80, 220);
  doc.text('BOT PLATFORM', 80, 260);
  
  // Subtitle
  doc.fillColor(COLORS.secondary);
  doc.font(FONTS.bold).fontSize(16).text('Technical Architecture & Workflow Specifications', 80, 305);
  
  // Colored horizontal bar
  doc.moveTo(80, 330).lineTo(480, 330).lineWidth(3).strokeColor(COLORS.secondary).stroke();

  // Intro text
  doc.fillColor(COLORS.darkText);
  doc.font(FONTS.regular).fontSize(10).text('A comprehensive blueprint outlining the Next.js frontend, NestJS backend API modules, data synchronization workflows, and automated communication flow-engine.', 80, 355, { width: 400, lineGap: 6 });

  // Metadata block (without Created Date, cleanly aligned)
  const metaY = 580;
  doc.fontSize(9.5).font(FONTS.bold).fillColor(COLORS.primary).text('TECHNICAL STACK OVERVIEW', 80, metaY);
  
  doc.moveTo(80, 595).lineTo(230, 595).lineWidth(1).strokeColor(COLORS.divider).stroke();

  const drawMetaRow = (label, val, y) => {
    doc.font(FONTS.bold).fontSize(8.5).fillColor(COLORS.darkText).text(label, 80, y);
    doc.font(FONTS.regular).fontSize(8.5).fillColor(COLORS.muted).text(val, 200, y);
  };

  drawMetaRow('Backend Stack', 'NestJS / TypeScript / MongoDB (Mongoose)', metaY + 15);
  drawMetaRow('Queue & Storage', 'Redis / BullMQ / Session Serialization', metaY + 30);
  drawMetaRow('Frontend Stack', 'Next.js 15 (App Router) / TailwindCSS / Zustand / React Query', metaY + 45);
  drawMetaRow('Automation Engine', 'whatsapp-web.js (Puppeteer Headless Instance)', metaY + 60);
}

// Function to start a clean new page for a section
function startSectionPage() {
  doc.addPage();
  currentY = 55;
}

function addHeading(text) {
  doc.font(FONTS.bold).fontSize(14).fillColor(COLORS.primary).text(text, 50, currentY);
  currentY += 20;
  doc.moveTo(50, currentY).lineTo(545, currentY).lineWidth(1.5).strokeColor(COLORS.secondary).stroke();
  currentY += 15;
}

function addSubHeading(text) {
  doc.font(FONTS.bold).fontSize(11).fillColor(COLORS.secondary).text(text, 50, currentY);
  currentY += 16;
}

function addParagraph(text, lineGap = 4) {
  const height = doc.heightOfString(text, { width: 495, lineGap });
  doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.darkText).text(text, 50, currentY, { width: 495, lineGap });
  currentY += height + 12;
}

function addBullet(label, text) {
  const fullText = `•  ${label}: ${text}`;
  const height = doc.heightOfString(fullText, { width: 475, lineGap: 3 });
  
  doc.font(FONTS.bold).fontSize(9).fillColor(COLORS.darkText).text(`•  ${label}: `, 60, currentY, { continued: true });
  doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.darkText).text(text, { width: 475, lineGap: 3 });
  currentY += height + 8;
}

function addCallout(text) {
  const height = doc.heightOfString(text, { width: 460, lineGap: 3 }) + 16;
  doc.rect(50, currentY, 495, height).fill(COLORS.lightGray);
  doc.rect(50, currentY, 3, height).fill(COLORS.primary);

  doc.font(FONTS.regular).fontSize(8.5).fillColor(COLORS.darkText).text(text, 65, currentY + 8, { width: 460, lineGap: 3 });
  currentY += height + 15;
}

function drawTable(headers, rows, columnWidths) {
  // Table Header
  let x = 50;
  doc.rect(50, currentY, 495, 22).fill(COLORS.primary);
  
  headers.forEach((header, index) => {
    doc.font(FONTS.bold).fontSize(8).fillColor(COLORS.white).text(header, x + 6, currentY + 7, { width: columnWidths[index] - 12 });
    x += columnWidths[index];
  });
  currentY += 22;

  // Table Body Rows
  rows.forEach((row, rowIndex) => {
    x = 50;
    const rowHeight = 22;
    
    // Alternating rows
    if (rowIndex % 2 === 1) {
      doc.rect(50, currentY, 495, rowHeight).fill(COLORS.lightGray);
    }
    
    // Bottom border for each row
    doc.moveTo(50, currentY + rowHeight)
       .lineTo(545, currentY + rowHeight)
       .lineWidth(0.5)
       .strokeColor(COLORS.divider)
       .stroke();

    row.forEach((cell, cellIndex) => {
      doc.font(FONTS.regular).fontSize(7.5).fillColor(COLORS.darkText).text(cell, x + 6, currentY + 7, { width: columnWidths[cellIndex] - 12 });
      x += columnWidths[cellIndex];
    });
    currentY += rowHeight;
  });
  
  currentY += 15;
}

// --- CONSTRUCT THE PDF DOCUMENT ---

// Page 1: Cover Page
renderCoverPage();

// Page 2: Section 1
startSectionPage();
addHeading('1. System Architecture & Core Objectives');
addParagraph('The WhatsApp Automation Bot is a highly scalable, multi-tenant capable platform that allows businesses to automate their customer operations directly over WhatsApp. By integrating browser automation with a structured REST API and a robust jobs queue, the platform circumvents the need for the official WhatsApp Business Cloud API while providing identical functional automation.');
addSubHeading('Core Capabilities');
addBullet('Multi-Instance QR Coupling', 'Allows multiple clients or numbers to be connected simultaneously. The backend provisions separate headless Chromium processes on the fly.');
addBullet('Background Campaign Queues', 'Schedules and dispatches bulk broadcast marketing notifications. Tasks are distributed through a background worker to ensure server thread safety.');
addBullet('State-Based Flow Responders', 'Evaluates incoming customer prompts against dynamic keyword schemas and guides users through interactive chat trees (e.g., placing orders or seeking support).');
addBullet('Unified Real-Time Inbox', 'Synthesizes conversations and system events into a single live chat interface for human agent intervention.');
addCallout('System Connection Resilience: All sessions are serialized directly in MongoDB. If the server experiences a restart, the application automatically triggers reconnect scripts to spin up background browser tasks without prompting the user for new QR scans.');

// Page 3: Section 2
startSectionPage();
addHeading('2. High-Level Technology Stack');
addParagraph('The architecture splits logic between a NestJS backend application and a Next.js frontend UI dashboard to enforce strict separation of concerns.');

addSubHeading('Backend Stack (NestJS Service Layer)');
addBullet('NestJS v11', 'The core structural framework utilizing dependency injection for modularity.');
addBullet('MongoDB & Mongoose', 'Document storage repository holding user metadata, customer tables, dynamic flows, and session connection tokens.');
addBullet('Redis & BullMQ', 'Handles high-frequency scheduled campaigns. Redis acts as the message broker, while BullMQ operates workers in independent execution pipelines.');
addBullet('whatsapp-web.js', 'Core API simulator driving Puppeteer instances in headless execution mode.');
addBullet('Security Modules', 'Passport-JWT strategy enforces route security, bcrypt hashes credentials, and Throttler limits API abuse.');

addSubHeading('Frontend Stack (Next.js User Interface)');
addBullet('Next.js v15', 'App router framework facilitating static rendering, Server Components, and modular API route proxies.');
addBullet('TailwindCSS', 'CSS design utility forming a clean dashboard layout and professional user interface components.');
addBullet('Zustand & React Query', 'Zustand coordinates light client state (sidebar status, active session variables), while React Query caches server resources.');
addBullet('Recharts', 'Displays analytical metrics (successful deliveries, failed dispatches, contact statistics).');

// Page 4: Section 3
startSectionPage();
addHeading('3. Core Workflows & Data Flows');
addParagraph('To ensure high performance and prevent thread locking, key events are processed asynchronously.');

addSubHeading('A. WhatsApp Session Connection Workflow');
addParagraph('1. The user navigates to the Settings page and clicks "Connect Device".\n2. The NestJS backend launches a new Puppeteer instance using `whatsapp-web.js`.\n3. The browser captures the QR code event from WhatsApp Web and converts the raw string to a QR DataURL.\n4. The database stores the QR code string in the `WhatsAppSession` document with status `QR_READY`.\n5. The frontend polls or listens to WebSockets, then renders the QR code. When scanned, the state transitions to `CONNECTED`.');

addSubHeading('B. Broadcast Campaign Dispatch Queue');
addParagraph('1. The marketing user builds a Campaign list and schedules a time.\n2. The backend serializes the campaign config and uploads contacts to the database.\n3. BullMQ pushes a dispatch job containing target list details to Redis.\n4. The queue processor (`campaign.processor.ts`) pops the job and retrieves the active user browser session.\n5. The system delivers messages to each contact sequentially, introducing randomized pauses (2-5 seconds) to prevent spam flags.');

addSubHeading('C. Automated Conversation Flow Handler');
addParagraph('1. An incoming message is detected on the server\'s Puppeteer browser listener.\n2. The `IncomingMessageService` parses the sender\'s phone number and creates/loads a `Customer` profile.\n3. A corresponding `Conversation` document is created/updated, appending the message history.\n4. If the user\'s bot status `isBotActive` is true, the auto-responder matches keywords against active `Flow` configurations.\n5. If a match occurs, it updates the conversation state and responds with structured menus.');

// Page 5: Section 4
startSectionPage();
addHeading('4. Backend Segment & Module Breakdown');
addParagraph('The NestJS backend organizes functionality into isolated modules to decouple domains. Below is the technical breakdown:');

const backendHeaders = ['Segment Module', 'Core Functions', 'Primary Database Schema'];
const backendRows = [
  ['auth', 'Coordinates user auth, signups, and JWT session tokens', 'User Schema (email, hash)'],
  ['whatsapp', 'Controls browser sessions, QR hooks, and socket instances', 'WhatsAppSession Schema'],
  ['campaigns', 'Manages broadcast campaign creation and job queues', 'Campaign Schema'],
  ['flows', 'Stores user-configured automated menus and triggers', 'Flow Schema'],
  ['conversations', 'Holds message history details and active bot variables', 'Conversation / Message Schema'],
  ['customers', 'Performs contact directory management and sorting', 'Customer Schema'],
  ['orders', 'Stores checkout details captured during automated flows', 'Order Schema'],
  ['imports', 'Handles CSV and Excel parsing algorithms', 'No database schema']
];
drawTable(backendHeaders, backendRows, [110, 235, 150]);

addSubHeading('Critical Service Breakdown');
addBullet('whatsapp.service.ts', 'Orchestrates active browser processes. Keeps a client map in memory (`Map<string, Client>`) mapping user accounts to Puppeteer page instances. Cleans up memory references during disconnections.');
addBullet('campaign.processor.ts', 'Runs BullMQ consumers. Reads queued marketing dispatches, broadcasts payloads, and captures transmission logs.');

// Page 6: Section 5
startSectionPage();
addHeading('5. Frontend Layout & Route Breakdown');
addParagraph('The Next.js frontend uses React 19 and App Router directory trees to form a responsive interface. Routes are structured as follows:');

const frontendHeaders = ['Route Path', 'UI Role & Features', 'Shared State / Stores'];
const frontendRows = [
  ['/ (root)', 'Validates credentials and redirects to Dashboard', 'Auth Zustand Store'],
  ['/(auth)/login', 'Authentication login forms with validations', 'React Hook Form, Zod'],
  ['/(dashboard)/dashboard', 'Displays charts and KPIs on successful deliveries', 'React Query cache'],
  ['/(dashboard)/whatsapp', 'Displays QR scanning panels and connection logs', 'React Query / WS state'],
  ['/(dashboard)/campaigns', 'Configures bulk list blasts and scheduler jobs', 'React Query & Zustand'],
  ['/(dashboard)/flows', 'Renders flow tree elements for editing bot trees', 'Zustand Store'],
  ['/(dashboard)/conversations', 'Provides live agent two-column inbox UI', 'Zustand Chat Store'],
  ['/(dashboard)/customers', 'Data tables showing customer lists and import modals', 'React Query & Papaparse']
];
drawTable(frontendHeaders, frontendRows, [140, 225, 130]);

addSubHeading('Aesthetic Integration');
addParagraph('The interface utilizes TailwindCSS classes with Inter typography. Hover transitions and status badges provide a responsive feel, while Recharts charts display real-time telemetry.');

// Page 7: Section 6
startSectionPage();
addHeading('6. Key Dependency & Integration Mapping');
addParagraph('The system aggregates multiple libraries to streamline execution:');
addBullet('whatsapp-web.js', 'Simulates web WhatsApp client actions inside headless Chromium.');
addBullet('BullMQ & ioredis', 'Distributes campaign broadcasts across background threads to maintain API stability.');
addBullet('Mongoose', 'Maps JavaScript classes to MongoDB documents for clean queries.');
addBullet('Zustand & React Query', 'Syncs application states. React Query handles cache invalidations while Zustand stores UI states.');
addBullet('Recharts', 'Generates responsive SVG analytics charts on the dashboard.');

addSubHeading('Conclusion');
addParagraph('This structure provides a performant and cost-effective WhatsApp automation alternative. Separating browser automation, queue pipelines, and modern interfaces ensures a stable platform.');

// Draw Headers and Footers on all pages
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(i);
  drawHeaderFooter(i + 1, range.count);
}

// End and save
doc.end();

stream.on('finish', () => {
  console.log('PDF documentation successfully generated at:', outputPath);
});
