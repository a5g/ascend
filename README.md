# ascend
ascend- Portfolio Management application

## Getting Started

Follow these step-by-step instructions to run the project locally.

### Prerequisites

*   **Node.js**: Make sure you have Node.js installed (v18 or higher recommended).
*   **pnpm**: We use pnpm for package management. Install it via `npm install -g pnpm`.
*   **Docker & Docker Compose**: Required for running the local database, Redis, and RabbitMQ.

### Installation & Setup

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```
    *Note:* If you encounter a `[ERR_PNPM_IGNORED_BUILDS]` error indicating ignored build scripts (e.g., for `protobufjs`), run:
    ```bash
    pnpm approve-builds
    pnpm install
    ```

2.  **Environment Variables:**
    Copy the example environment file and configure it if necessary:
    ```bash
    cp .env.example .env
    ```

3.  **Start Local Infrastructure:**
    Start the required services (PostgreSQL, Redis, RabbitMQ) using Docker Compose:
    ```bash
    docker compose up -d
    ```

4.  **Build the Workspace:**
    Build all packages and applications in the monorepo:
    ```bash
    pnpm build
    ```

### Running the Application

1.  **Start the API Server:**
    In a new terminal, run the backend API service:
    ```bash
    pnpm --filter @ascend/api run start
    ```

2.  **Start the Web UI:**
    In another terminal, start the frontend Vite web shell:
    ```bash
    pnpm --filter @ascend/web run dev
    ```

The frontend application should now be accessible at `http://localhost:3000` (or the port specified in your terminal output).
