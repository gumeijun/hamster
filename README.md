# Hamster - Free & Powerful MySQL Database Manager

> 🐹 **Hamster** is a modern MySQL database management tool built with Electron. It aims to be a lightweight, free alternative to Navicat.

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)

## 📖 Introduction

Hamster is designed for developers and database administrators, providing a clean, efficient, and completely free graphical interface for managing MySQL databases. It integrates core functions such as data browsing, table structure design, and SQL queries, helping you say goodbye to expensive software subscriptions and easily manage your data.

## ✨ Highlights

*   💸 **Free Forever**: Open source and free, no cracking required, zero cost.
*   🚀 **Lightweight & Fast**: Built on Electron + React + Vite stack, fast startup and low resource usage.
*   🎯 **Navicat Alternative**: Replicates classic operation habits with zero learning curve.
*   🛡️ **Data Security**: All connection info is stored locally; direct connection to your database ensures security.

## 🛠️ Features

### 1. Multi-Connection Management
*   Create, edit, and delete multiple MySQL connections.
*   Intuitive tree view for quick database switching.

### 2. Visual Table Designer
*   **Structure Editing**: Add, modify, and delete fields (Type, Length, Default, Comment, Not Null, etc.).
*   **Index Management**: Support for PRIMARY, UNIQUE, NORMAL, and FULLTEXT indexes.
*   **Real-time Save**: Intelligently generates `ALTER TABLE` statements to safely update table structures.

### 3. Efficient Data Management (Data Viewer)
*   **Data Browsing**: Pagination support for large datasets.
*   **Advanced Filtering**: Built-in rich filter conditions (`=`, `LIKE`, `IN`, `BETWEEN`, `IS NULL`, etc.) with multi-condition support.
*   **Quick Edit**: Double-click cells to modify data directly.
*   **CRUD Operations**: Add new records and batch delete selected records.
*   **Auto Refresh**: Automatically refreshes the view after truncating tables or modifying data.

### 4. SQL Development & Maintenance
*   **SQL Query Editor**: Supports multi-statement execution for quick logic verification.
*   **Import / Export**:
    *   Export database structure and data (`.sql`).
    *   Import and execute SQL script files.
*   **Table Operations**: Support for Truncate, Drop, and Rename tables.

### 5. Modern Interaction
*   **Multi-Tab Interface**: Browser-like tabs to handle multiple tables or queries simultaneously.
*   **Context Menu**: Rich right-click menus for quick access to operations.

## 🏗️ Tech Stack

*   **Runtime**: Electron
*   **Frontend**: React, TypeScript, Tailwind CSS
*   **Build Tool**: Vite
*   **Database Driver**: mysql2
*   **Editor**: Monaco Editor (VS Code core)

## 🚀 Getting Started

### Development

```bash
# 1. Clone the repository
git clone https://github.com/gumeijun/hamster.git
cd hamster

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

### Build

```bash
# Build for production (macOS/Windows/Linux)
npm run build
```

*Build artifacts will be generated in the `release/` directory.*

## 🤝 Contributing

Issues and Pull Requests are welcome! Let's build the best free database management tool together.

## 📄 License

ISC License © 2024 Gu
