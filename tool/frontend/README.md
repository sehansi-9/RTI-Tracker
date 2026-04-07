# RTI Tracker

A frontend application for managing and tracking RTI (Right to Information) requests.

## Getting Started

Follow these steps to set up and run the application locally:

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Start the development server:**

   ```bash
   npm run dev
   ```

3. **Navigate to the App:**
   Once the server starts, open your web browser and navigate to the address shown in your terminal (eg: `http://localhost:5173`) to begin using the application.

## Running Tests

This project uses **Playwright** for End-to-End (E2E) testing.

1. **Install Browsers (First time only):**
   ```bash
   npx playwright install
   ```

2. **Run all tests:**
   ```bash
   npx playwright test
   ```

3. **View the latest HTML report:**
   ```bash
   npx playwright show-report
   ```

4. **Use UI Mode (Interactive):**
   ```bash
   npx playwright test --ui
   ```
