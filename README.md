# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Local AI with Ollama (free, local-only)

This repo now includes a lightweight local AI backend at `ai-server/server.mjs`.

1. Start Ollama locally (default URL: `http://127.0.0.1:11434`) and pull a model:
```sh
ollama pull qwen2.5:3b-instruct
```
2. Run the AI backend:
```sh
npm run ai:dev
```
3. Run the frontend:
```sh
npm run dev
```

Optional environment variables:
- `AI_PORT` (default `8787`)
- `AI_PROVIDER` (default `ollama`)
- `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`)
- `OLLAMA_MODEL` (default `qwen2.5:3b-instruct`)
- `OLLAMA_TIMEOUT_MS` (default `120000`)
- `AI_ALLOWED_ORIGIN` (default `http://localhost:8080`)
- `AI_RATE_LIMIT_WINDOW_MS` (default `60000`)
- `AI_RATE_LIMIT_MAX` (default `30`)
- `VITE_AI_BASE_URL` (frontend; default `http://localhost:8787`)

AI endpoints available:
- `POST /ai/insights` for daily business summaries
- `POST /ai/reorder` for 7-day stock/resource planning (works for product and service businesses)
- `POST /ai/query` for direct Q&A over provided context

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
