# MedEasy Frontend

Client application built with **React 19**, **TypeScript**, **Vite**, and **Tailwind CSS**.

## Setup & Running

```bash
# Install dependencies
npm install

# Start local Vite development server
npm run dev

# Production build and typecheck
npm run build

# Code linting
npm run lint
```

## Environment Configuration

Configure the backend API URL by creating a `.env.local` file:

```env
VITE_API_BASE_URL=http://localhost:8000
```
*(Defaults to `http://127.0.0.1:8000` if omitted).*

