# React + TypeScript
**What it does**: Core framework for building the UI

**Why it’s good**:
- Component-based design
- Huge ecosystem
- Type safety with TypeScript reduces bugs and improves code clarity

**Alternatives**:
- Vue: Simpler syntax, faster to learn, but less common in large projects
- Svelte: Very lightweight and reactive, but smaller ecosystem
- Plain JS/HTML: Easy to start, but not scalable

**For this project**:
React is by far the most versatile and well supported front end framework. The alternatives are only better under very specific scenarios, none of which are present here.

# Tailwind CSS
**What it does**: Utility-first styling system

**Why it’s good**:
- Rapid styling directly in JSX
- Built-in dark mode, responsive utilities, and accessibility features
- Encourages design consistency

**Alternatives**:
- CSS Modules / SCSS: Traditional, more verbose, slower to iterate
- Bootstrap: Good for quick mockups, but harder to customize
- Styled Components: Works well with JS, but adds runtime overhead

**For this project**:
the ease of use and consistency offered by tailwind makes it better than the alternatives.

# Zustand
***What it does***: Lightweight state management

***Why it’s good***:
- Simple syntax and low boilerplate
- Excellent performance (fine-grained subscriptions)
- Works well with LocalStorage and React

**Alternatives**:
- Redux Toolkit: Great for large teams/apps, but more complex
- Recoil: Better for complex relationships, less mature
- Context API: Good for light state, but inefficient for frequent updates
- Why Zustand: Easy to integrate, no setup overhead, perfect for your personal/team project.

**For this project**:
the simplicity of Zustand makes it the best in this case. It is a small project, and doesn't need the extra power of something like Redux.

# Next.js
**What it does**: Full React framework with routing, API routes, rendering control, and deployment integration

**Why it’s good**:
- File-based routing (no React Router needed)
- Built-in API support (acts as backend)
- Supports static generation, server-side rendering, and client rendering
- Integrated with Vercel for painless deployment

**Alternatives**:
- CRA (Create React App): Only frontend, no backend support
- Remix: More advanced routing and data loading model, but newer
- Gatsby: Built for static sites, overkill for dynamic/group scheduling

**For this project**:
It has a good balance of power and ease, and it works well with Vercel. 

# OneSignal
**What it does**: Push notification platform for sending alerts to users on web and mobile (you'll use web). Great for notifying users about upcoming events, registration, or group updates.

**Why it’s good**:
- Easiest web push setup available
- Has a clean, powerful dashboard for manual or scheduled notifications
- Automatically handles permission prompts, device tokens, and browser quirks
- Works well in SPAs like React/Next.js apps

**Alternatives**:
- Firebase Cloud Messaging (FCM): More control and no vendor lock-in, but harder to set up (requires service workers, messaging setup, etc.)
- Pusher Beams: Easier than FCM, less dashboard control than OneSignal
- Email (SendGrid/Mailgun): Great for long-form or transactional messaging, not ideal for real-time alerts
- Twilio (SMS): Reliable but costly and excessive for small teams

**For this project**:
I'm not deploying in Firebase, so simply writing my notification system using FCM would be more work than needed. OneSignal is a much easier alternative, and their free service offers more than enough usage for the scope of this project

# Vercel
**What it does**: Hosts your Next.js app (frontend + backend in one)

**Why it’s good**:
- Zero-config support for Next.js features (API routes, SSR, ISR)
- Free tier with generous limits
- GitHub integration + preview deployments
- Global CDN

**Alternatives**:
- Netlify: Also excellent, but requires plugins/config to support Next.js API routes
- Render/Fly.io: Better for custom backend services, not as seamless for full-stack Next.js
- Heroku: Easy to use, but slower and less modern for frontend apps

**For this project**:
Vercel is built to easily work with next.js, and their free tier is more than sufficient for this project's needs.
