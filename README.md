# Cafe Management System - Authentication Module

This is a full-stack authentication module built with Node.js, Express, MySQL, and Vanilla JavaScript.

## Prerequisites
- Node.js installed
- MySQL Server (MySQL Workbench) running

## Setup Instructions

1. **Install Dependencies**:
   Open a terminal in the `server` directory and run:
   ```bash
   npm install
   ```

2. **Database Configuration**:
   Open the `server/.env` file and update your MySQL credentials:
   ```env
   DB_USER=root
   DB_PASSWORD=your_mysql_password_here
   ```
   *Note: If you don't have a password, leave it blank.*

3. **Start the Server**:
   Run the following command in the `server` folder:
   ```bash
   node server.js
   ```
   The database (`cafe_db`) and table (`users`) will be created automatically.

4. **Launch Frontend**:
   - Open `client/signup.html` in your web browser.
   - Register a new user.
   - After successful registration, you will be redirected to `login.html`.

## Features
- **MVC Architecture**: Organized backend code.
- **Auto-DB Initialization**: No need to manually run SQL scripts.
- **Secure Hashing**: Passwords stored using `bcryptjs`.
- **JWT Authentication**: Token-based login for security.
- **Validation**: Frontend and backend validation for email format and empty fields.
